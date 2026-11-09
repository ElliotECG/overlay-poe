// My Ritualist Overlay: "Compare in PoB".
//
// Hover an item (in a merchant tab, a stash...), press the shortcut: the item
// is put in place of the matching equipped item in the character's
// Path of Building build, and the overlay shows how DPS, life, defences and
// resistances change.
//
// - The build comes from the character's poe.ninja page (its Path of Building
//   export), refreshed when it is older than 30 minutes.
// - The calculations run in the user's installed Path of Building 2, started
//   without its window by LuaJIT (main/pob/pob-server.lua).
import { app } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import type { Server, IncomingMessage, ServerResponse } from "http";
import type { Logger } from "./RemoteLogger";
import { uIOhook, UiohookKey } from "uiohook-napi";
import { eventPipe } from "./server";

const BUILD_MAX_AGE_MS = 30 * 60 * 1000;
const LOAD_TIMEOUT_MS = 90_000;
const COMPARE_TIMEOUT_MS = 20_000;

// ------------------------------------------------------------------ files

const dataDir = () => path.join(app.getPath("userData"), "pob-compare");
const settingsFile = () => path.join(dataDir(), "settings.json");
const buildFile = () => path.join(dataDir(), "build.xml");

/** main/pob in development, resources/pob once installed */
function engineDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "pob")
    : path.join(__dirname, "..", "pob");
}

interface Settings {
  profileUrl?: string;
  /** label of the chosen main skill (indexes change when the build changes) */
  skill?: string;
  /** Path of Building folder chosen by the user (else auto-detected) */
  pobDir?: string;
  fetchedAt?: number;
}

let settings: Settings = {};

function loadSettings() {
  try {
    settings = JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
  } catch {
    settings = {};
  }
}

function saveSettings() {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
}

/** The installed Path of Building 2 (it has Launch.lua next to its exe) */
function findPobDir(): string | null {
  const candidates = [
    settings.pobDir,
    path.join(app.getPath("appData"), "Path of Building Community (PoE2)"),
    path.join(process.env.ProgramData ?? "C:\\ProgramData", "Path of Building Community (PoE2)"),
    "C:\\Program Files\\Path of Building Community (PoE2)",
  ];
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, "Launch.lua"))) return dir;
  }
  return null;
}

// ------------------------------------------------------------ poe.ninja

interface NinjaProfile {
  account: string;
  league: string;
  name: string;
}

/** https://poe.ninja/poe2/profile/<account>/<league>/character/<name> */
export function parseProfileUrl(url: string): NinjaProfile | null {
  const m = /poe\.ninja\/poe2\/profile\/([^/?#]+)\/([^/?#]+)\/character\/([^/?#]+)/i.exec(
    url.trim(),
  );
  if (!m) return null;
  return {
    account: decodeURIComponent(m[1]),
    league: decodeURIComponent(m[2]),
    name: decodeURIComponent(m[3]),
  };
}

/** Path of Building XML of the character, from its poe.ninja page */
async function fetchBuildXml(profile: NinjaProfile): Promise<string> {
  const e = encodeURIComponent;
  const url =
    `https://poe.ninja/poe2/api/profile/characters/${e(profile.account)}/` +
    `${e(profile.league)}/${e(profile.name)}/model/80`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`poe.ninja ${res.status}`);
  const data = (await res.json()) as {
    type?: string;
    charModel?: { pathOfBuildingExport?: string };
  };
  const code = data.charModel?.pathOfBuildingExport;
  if (!code) throw new Error("poe.ninja: character not found");
  const bytes = Buffer.from(code.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  return zlib.inflateSync(bytes).toString("utf8");
}

// ---------------------------------------------------------- the engine

interface EngineAnswer {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

let engine: ChildProcessWithoutNullStreams | null = null;
let engineReady: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<number, (answer: EngineAnswer) => void>();
let buildSummary: EngineAnswer | null = null;
let lastError: string | null = null;

function stopEngine() {
  engine?.kill();
  engine = null;
  engineReady = null;
  buildSummary = null;
  for (const resolve of pending.values()) resolve({ ok: false, error: "engine-stopped" });
  pending.clear();
}

async function startEngine(logger: Logger): Promise<void> {
  if (engineReady) { await engineReady; return; }
  const pobDir = findPobDir();
  if (!pobDir) { await Promise.reject(new Error("pob-not-found")); return; }

  const dir = engineDir();
  const userDir = path.join(dataDir(), "pob-user");
  fs.mkdirSync(userDir, { recursive: true });
  const proc = spawn(
    path.join(dir, "luajit", "luajit.exe"),
    [path.join(dir, "pob-server.lua"), dir, userDir + path.sep],
    { cwd: pobDir, windowsHide: true },
  );
  engine = proc;

  engineReady = new Promise<void>((resolve, reject) => {
    let buf = "";
    let started = false;
    let errTail = "";
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => {
      buf += chunk;
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        let answer: EngineAnswer;
        try {
          answer = JSON.parse(line);
        } catch {
          continue;
        }
        if (!started) {
          started = true;
          if (answer.ok) resolve();
          else reject(new Error(answer.error ?? "pob-startup"));
          continue;
        }
        const id = Number(answer.id);
        const done = pending.get(id);
        if (done) {
          pending.delete(id);
          done(answer);
        }
      }
    });
    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (chunk: string) => {
      errTail = (errTail + chunk).slice(-2000);
    });
    proc.on("error", (e) => {
      reject(e);
    });
    proc.on("exit", (code) => {
      if (engine !== proc) return;
      logger.write(`warn [PoB] engine stopped (${code}): ${errTail.split("\n").slice(-3).join(" | ")}`);
      if (!started) reject(new Error("pob-startup"));
      stopEngine();
    });
  });
  engineReady.catch(() => {
    stopEngine();
  });
  await engineReady;
}

async function ask(logger: Logger, req: object, timeoutMs: number): Promise<EngineAnswer> {
  await startEngine(logger);
  const id = nextId++;
  return await new Promise<EngineAnswer>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ ok: false, error: "timeout" });
    }, timeoutMs);
    pending.set(id, (answer) => {
      clearTimeout(timer);
      resolve(answer);
    });
    engine!.stdin.write(JSON.stringify({ ...req, id }) + "\n");
  });
}

// ------------------------------------------------------------ the build

/** Loads the saved build in the engine, refreshing it from poe.ninja if old */
async function ensureBuild(logger: Logger, forceRefresh = false): Promise<EngineAnswer> {
  if (!settings.profileUrl) return { ok: false, error: "no-profile" };
  const profile = parseProfileUrl(settings.profileUrl);
  if (!profile) return { ok: false, error: "bad-profile-url" };

  const old = !settings.fetchedAt || Date.now() - settings.fetchedAt > BUILD_MAX_AGE_MS;
  let xml: string | null = null;
  if (forceRefresh || old || !fs.existsSync(buildFile())) {
    try {
      xml = await fetchBuildXml(profile);
      fs.mkdirSync(dataDir(), { recursive: true });
      fs.writeFileSync(buildFile(), xml);
      settings.fetchedAt = Date.now();
      saveSettings();
      buildSummary = null; // reload below
    } catch (e) {
      // poe.ninja unreachable: keep the saved build if there is one
      lastError = (e as Error).message;
      logger.write(`warn [PoB] build refresh failed: ${lastError}`);
      if (!fs.existsSync(buildFile())) return { ok: false, error: lastError };
    }
  }
  if (buildSummary?.ok && engine) return buildSummary;

  xml ??= fs.readFileSync(buildFile(), "utf8");
  const answer = await ask(logger, { cmd: "load", xml, skill: settings.skill }, LOAD_TIMEOUT_MS);
  if (answer.ok) {
    buildSummary = answer;
    lastError = null;
  } else {
    lastError = answer.error ?? "load-failed";
  }
  return answer;
}

function status() {
  const pobDir = findPobDir();
  return {
    pobFound: pobDir != null,
    pobDir,
    profileUrl: settings.profileUrl ?? null,
    fetchedAt: settings.fetchedAt ?? null,
    build: buildSummary?.ok
      ? {
          className: buildSummary.className,
          level: buildSummary.level,
          skills: buildSummary.skills,
          mainSkill: buildSummary.mainSkill,
          mainSkillLabel: buildSummary.mainSkillLabel,
          stats: buildSummary.stats,
        }
      : null,
    error: lastError,
  };
}

// ---------------------------------------------------------------- routes

async function readBody(req: IncomingMessage, limit = 1024 * 1024): Promise<string> {
  return await new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        req.destroy();
        reject(new Error("too-large"));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => { resolve(Buffer.concat(chunks).toString("utf8")); });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, body: unknown, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

async function handle(url: string, req: IncomingMessage, logger: Logger): Promise<unknown> {
  if (url.startsWith("/atziri-pob/status") && req.method === "GET") {
    return status();
  }
  if (url.startsWith("/atziri-pob/profile") && req.method === "POST") {
    const { url: profileUrl } = JSON.parse(await readBody(req)) as { url?: string };
    if (!profileUrl || !parseProfileUrl(profileUrl)) {
      return { ...status(), error: "bad-profile-url" };
    }
    settings.profileUrl = profileUrl.trim();
    settings.skill = undefined;
    settings.fetchedAt = undefined;
    saveSettings();
    buildSummary = null;
    await ensureBuild(logger, true);
    return status();
  }
  if (url.startsWith("/atziri-pob/refresh") && req.method === "POST") {
    await ensureBuild(logger, true);
    return status();
  }
  if (url.startsWith("/atziri-pob/skill") && req.method === "POST") {
    const { index } = JSON.parse(await readBody(req)) as { index?: number };
    const loaded = await ensureBuild(logger);
    if (!loaded.ok) return status();
    const answer = await ask(logger, { cmd: "skill", index }, COMPARE_TIMEOUT_MS);
    if (answer.ok) {
      buildSummary = answer;
      settings.skill = String(answer.mainSkillLabel ?? "");
      saveSettings();
    }
    return status();
  }
  if (url.startsWith("/atziri-pob/compare") && req.method === "POST") {
    const item = await readBody(req, 64 * 1024);
    const loaded = await ensureBuild(logger);
    if (!loaded.ok) {
      openCard();
      return loaded;
    }
    const answer = await ask(logger, { cmd: "compare", item }, COMPARE_TIMEOUT_MS);
    // the card shows from now on
    openCard();
    return answer;
  }
  return undefined;
}

// The result card is shown while the game keeps the mouse (clicks go to the
// game, not to the overlay): the first click or Escape in game closes it
let cardOpen = false;

// Clicks don't close it: they are part of browsing a merchant tab. It closes
// with Escape, or once the mouse has moved well away from the item.
const MOVE_AWAY_PX = 450;
const GRACE_MS = 1000;
let cardOpenedAt = 0;
let anchor: { x: number; y: number } | null = null;

function openCard() {
  cardOpen = true;
  cardOpenedAt = Date.now();
  anchor = null;
}

function closeCardOnInput() {
  const dismiss = () => {
    if (!cardOpen) return;
    cardOpen = false;
    eventPipe.sendEventTo("broadcast", {
      name: "MAIN->CLIENT::pob-dismiss",
      payload: undefined,
    });
  };
  uIOhook.on("keydown", (e) => {
    if (e.keycode === UiohookKey.Escape) dismiss();
  });
  uIOhook.on("mousemove", (e) => {
    if (!cardOpen) return;
    // where the mouse was when the result appeared (the hovered item)
    anchor ??= { x: e.x, y: e.y };
    if (Date.now() - cardOpenedAt < GRACE_MS) return;
    if (Math.hypot(e.x - anchor.x, e.y - anchor.y) > MOVE_AWAY_PX) dismiss();
  });
}

/** Routes /atziri-pob/* used by the overlay page */
export function setupAtziriPob(server: Server, logger: Logger) {
  loadSettings();
  app.on("will-quit", stopEngine);
  closeCardOnInput();

  server.prependListener("request", (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "";
    if (!url.startsWith("/atziri-pob/")) return;
    (req as IncomingMessage & { atziriHandled?: boolean }).atziriHandled = true;
    handle(url, req, logger)
      .then((body) => {
        if (body === undefined) {
          res.statusCode = 404;
          res.end();
        } else {
          sendJson(res, body);
        }
      })
      .catch((e: Error) => {
        const error = e.message === "pob-not-found" ? "pob-not-found" : e.message;
        lastError = error;
        sendJson(res, { ok: false, error }, 200);
      });
  });
}
