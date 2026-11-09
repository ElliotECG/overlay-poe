// My Ritualist Overlay: "Compare in PoB".
//
// Hover an item (in a merchant tab, a stash...), press the shortcut: the item
// is put in place of the matching equipped item in the character's
// Path of Building build, and the overlay shows how DPS, life, defences and
// resistances change.
//
// - The build comes from Path of Building itself (a build saved there after
//   importing the character from the official site; reloaded each time it is
//   saved), or from the character's poe.ninja page (its Path of Building
//   export, which poe.ninja only updates every few hours), refreshed when it
//   is older than 30 minutes.
// - poe.ninja's automatic mode follows the character being played: the one the game log
//   shows (level-ups of non-party players, quest rewards), else the account's
//   current character (★) on poe.ninja.
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
  /**
   * Where the build comes from: "pob", a build saved in Path of Building
   * (imported there from the official site, always up to date), or "ninja",
   * the character's poe.ninja page (only refreshed every few hours there)
   */
  source?: "pob" | "ninja";
  /** "pob" source: the build file chosen, else the last one saved */
  pobBuild?: string;
  /** "pob" source: build file the chosen skill (skill) belongs to */
  skillBuild?: string;
  /**
   * "auto": the character currently played on the account (poe.ninja ★ and
   * the game log); "manual": always the character of profileUrl
   */
  mode?: "auto" | "manual";
  /** poe.ninja account, e.g. "solana-2049" */
  account?: string;
  /** name of the last character the game log showed as being played */
  logCharacter?: string;
  /** last level-up of the played character in the game log (class in the game's language) */
  logLevel?: { name: string; level: number; className?: string };
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
  // settings from before the automatic mode: follow the account of the link
  if (!settings.mode && settings.profileUrl) {
    settings.account = parseAccount(settings.profileUrl) ?? undefined;
    settings.mode = settings.account ? "auto" : "manual";
  }
  // settings from before the Path of Building source: poe.ninja was the only one
  settings.source ??= settings.profileUrl ? "ninja" : "pob";
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

// ------------------------------------------- builds saved in Path of Building

/**
 * Folder where Path of Building 2 saves its builds:
 * Documents\Path of Building (PoE2)\Builds, unless changed in its options
 */
export function pobBuildsDir(): string {
  const userPath = path.join(app.getPath("documents"), "Path of Building (PoE2)");
  try {
    const xml = fs.readFileSync(path.join(userPath, "Settings.xml"), "utf8");
    const custom = /\bbuildPath="([^"]+)"/.exec(xml)?.[1];
    if (custom) return path.resolve(custom);
  } catch {
    // Path of Building never started: default folder
  }
  return path.join(userPath, "Builds");
}

interface SavedBuild {
  file: string;
  /** name shown in Path of Building (folder/name, without .xml) */
  name: string;
  savedAt: number;
}

/** Builds saved in Path of Building, the last saved first */
function listPobBuilds(): SavedBuild[] {
  const root = pobBuildsDir();
  const found: SavedBuild[] = [];
  const walk = (dir: string, depth: number) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && depth < 3) walk(full, depth + 1);
      else if (e.isFile() && e.name.toLowerCase().endsWith(".xml")) {
        try {
          found.push({
            file: full,
            name: path.relative(root, full).replace(/\.xml$/i, "").replace(/\\/g, "/"),
            savedAt: Math.round(fs.statSync(full).mtimeMs),
          });
        } catch {
          // removed meanwhile
        }
      }
    }
  };
  walk(root, 0);
  return found.sort((a, b) => b.savedAt - a.savedAt);
}

/** Build file used with the "pob" source: the chosen one, else the last saved */
function currentPobBuild(): SavedBuild | null {
  const list = listPobBuilds();
  if (settings.pobBuild) {
    return list.find((b) => b.file === settings.pobBuild) ?? null;
  }
  return list[0] ?? null;
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

// The poe.ninja API wants a number at the end of its addresses; any value
// works, it only splits caches: a new one every minute gives fresh data
const cacheKey = () => Math.floor(Date.now() / 60_000);

/** Account part of a poe.ninja link (profile or character page) */
export function parseAccount(url: string): string | null {
  const m = /poe\.ninja\/poe2\/profile\/([^/?#]+)/i.exec(url.trim());
  return m ? decodeURIComponent(m[1]) : null;
}

interface NinjaCharacter {
  name: string;
  level: number;
  league: string;
  leagueUrl: string;
  className: string;
  isCurrent?: boolean;
  updated?: string;
}

const CHARACTERS_MAX_AGE_MS = 2 * 60 * 1000;
let characters: { account: string; at: number; list: NinjaCharacter[] } | null = null;

/** Characters of the account on poe.ninja (★ isCurrent: the one played) */
async function fetchCharacters(account: string): Promise<NinjaCharacter[]> {
  if (characters?.account === account && Date.now() - characters.at < CHARACTERS_MAX_AGE_MS) {
    return characters.list;
  }
  const url =
    `https://poe.ninja/poe2/api/profile/characters/${encodeURIComponent(account)}/${cacheKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`poe.ninja ${res.status}`);
  const list = (await res.json()) as NinjaCharacter[];
  characters = { account, at: Date.now(), list };
  return list;
}

/**
 * Character to compare with, in automatic mode: the one the game log shows
 * (when poe.ninja knows it), else the account's current character.
 */
async function pickCurrentCharacter(account: string): Promise<NinjaCharacter | null> {
  const list = await fetchCharacters(account);
  const fromLog = settings.logCharacter
    ? list.find((c) => c.name === settings.logCharacter)
    : undefined;
  return fromLog ?? list.find((c) => c.isCurrent) ?? null;
}

function profileUrlOf(account: string, c: NinjaCharacter) {
  const e = encodeURIComponent;
  return `https://poe.ninja/poe2/profile/${e(account)}/${e(c.leagueUrl)}/character/${e(c.name)}`;
}

/** Path of Building XML of the character, from its poe.ninja page */
async function fetchBuildXml(profile: NinjaProfile): Promise<string> {
  const e = encodeURIComponent;
  const url =
    `https://poe.ninja/poe2/api/profile/characters/${e(profile.account)}/` +
    `${e(profile.league)}/${e(profile.name)}/model/${cacheKey()}`;
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

let currentCharacter: NinjaCharacter | null = null;

/**
 * Automatic mode: follows the character being played. Switches the build
 * when it is another character than the loaded one.
 */
async function followCurrentCharacter(logger: Logger) {
  if (settings.mode !== "auto" || !settings.account) return;
  try {
    const current = await pickCurrentCharacter(settings.account);
    if (!current) return;
    currentCharacter = current;
    const url = profileUrlOf(settings.account, current);
    if (url !== settings.profileUrl) {
      logger.write(`info [PoB] now comparing with ${current.name} (${current.league}).`);
      settings.profileUrl = url;
      settings.skill = undefined;
      settings.fetchedAt = undefined;
      saveSettings();
      buildSummary = null;
    }
  } catch (e) {
    // poe.ninja unreachable: keep the current build
    logger.write(`warn [PoB] character list failed: ${(e as Error).message}`);
  }
}

/**
 * What the engine has loaded: "ninja", or "pob|<file>|<save time>" (a new
 * save of the file in Path of Building is a new build)
 */
let loadedKey: string | null = null;


/** "pob" source: loads the build file, again each time it is saved */
async function ensurePobBuild(logger: Logger): Promise<EngineAnswer> {
  const saved = currentPobBuild();
  if (!saved) {
    lastError = settings.pobBuild ? "pob-build-missing" : "no-pob-build";
    return { ok: false, error: lastError };
  }
  const key = `pob|${saved.file}|${saved.savedAt}`;
  if (buildSummary?.ok && engine && loadedKey === key) return buildSummary;

  // another build: its own main skill (the one chosen in Path of Building)
  if (settings.skillBuild !== saved.file) {
    settings.skill = undefined;
    settings.skillBuild = saved.file;
    saveSettings();
  }
  const xml = fs.readFileSync(saved.file, "utf8");
  const answer = await ask(logger, { cmd: "load", xml, skill: settings.skill }, LOAD_TIMEOUT_MS);
  if (answer.ok) {
    buildSummary = answer;
    loadedKey = key;
    lastError = null;
    logger.write(`info [PoB] build "${saved.name}" loaded (saved ${new Date(saved.savedAt).toLocaleString()}).`);
  } else {
    lastError = answer.error ?? "load-failed";
  }
  return answer;
}

/** Loads the build in the engine: from Path of Building, or from poe.ninja */
async function ensureBuild(logger: Logger, forceRefresh = false): Promise<EngineAnswer> {
  if (settings.source === "pob") return await ensurePobBuild(logger);
  await followCurrentCharacter(logger);
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
  if (buildSummary?.ok && engine && loadedKey === "ninja") return buildSummary;

  xml ??= fs.readFileSync(buildFile(), "utf8");
  const answer = await ask(logger, { cmd: "load", xml, skill: settings.skill }, LOAD_TIMEOUT_MS);
  if (answer.ok) {
    buildSummary = answer;
    loadedKey = "ninja";
    lastError = null;
  } else {
    lastError = answer.error ?? "load-failed";
  }
  return answer;
}

/**
 * The last comparisons (item text sent to Path of Building and its answer),
 * kept in pob-compare/last-comparisons.json to understand surprising results
 */
const KEEP_COMPARISONS = 10;
function rememberComparison(item: string, answer: EngineAnswer) {
  const file = path.join(dataDir(), "last-comparisons.json");
  let list: unknown[] = [];
  try {
    list = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // first one
  }
  list.unshift({ at: new Date().toISOString(), character: settings.profileUrl, item, answer });
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(list.slice(0, KEEP_COMPARISONS), null, 1));
  } catch {
    // not important
  }
}

/** When the build in use was taken: saved in Path of Building, or read on poe.ninja */
function buildInfo() {
  if (settings.source === "pob") {
    const saved = currentPobBuild();
    return { source: "pob" as const, name: saved?.name ?? null, at: saved?.savedAt ?? null };
  }
  return {
    source: "ninja" as const,
    name: currentCharacter?.name ?? parseProfileUrl(settings.profileUrl ?? "")?.name ?? null,
    at: settings.fetchedAt ?? null,
  };
}

export interface PlayedCharacter {
  /** shown name of the class (the game's language when it comes from the game log) */
  className?: string;
  /** English ascendancy (or class) of the build, e.g. "Ritualist" */
  ascendancy?: string;
  level?: number;
}

/**
 * The character being played, for the Discord status: the build compared
 * with (its ascendancy, in English), with the level of the last level-up the
 * game log showed for the played character
 */
export function pobCharacter(): PlayedCharacter | null {
  const build = buildCharacter();
  const log =
    settings.logLevel && settings.logLevel.name === settings.logCharacter
      ? settings.logLevel
      : undefined;
  if (!log) return build ? { ...build, ascendancy: build.className } : null;
  // same class in both? ("Ritualist" / "Ritualiste": the log is in the game's language)
  const sameClass =
    !build?.className ||
    !log.className ||
    build.className.slice(0, 5).toLowerCase() === log.className.slice(0, 5).toLowerCase();
  if (!sameClass) {
    // another character than the build's: its class and level only
    return { className: log.className, level: log.level };
  }
  return {
    className: log.className ?? build?.className,
    ascendancy: build?.className,
    level: Math.max(log.level, build?.level ?? 0),
  };
}

/** Class and level of the build compared with */
function buildCharacter(): { className?: string; level?: number } | null {
  if (buildSummary?.ok) {
    const className = buildSummary.className;
    return {
      className: typeof className === "string" && className !== "None" ? className : undefined,
      level: typeof buildSummary.level === "number" ? buildSummary.level : undefined,
    };
  }
  // not loaded in Path of Building yet: the <Build ...> line of the file
  try {
    const file = settings.source === "pob" ? currentPobBuild()?.file : buildFile();
    if (!file) return null;
    const fd = fs.openSync(file, "r");
    const head = Buffer.alloc(4096);
    const size = fs.readSync(fd, head, 0, head.length, 0);
    fs.closeSync(fd);
    const tag = /<Build\s[^>]*>/.exec(head.subarray(0, size).toString("utf8"))?.[0];
    if (!tag) return null;
    const attr = (name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
    const className = attr("ascendClassName") || attr("className");
    const level = Number(attr("level"));
    return {
      className: className && className !== "None" ? className : undefined,
      level: Number.isFinite(level) && level > 0 ? level : undefined,
    };
  } catch {
    return null;
  }
}

function status() {
  const pobDir = findPobDir();
  return {
    pobFound: pobDir != null,
    pobDir,
    source: settings.source ?? "pob",
    buildsDir: pobBuildsDir(),
    builds: listPobBuilds().slice(0, 50).map((b) => ({ file: b.file, name: b.name, savedAt: b.savedAt })),
    pobBuild: settings.pobBuild ?? null,
    buildInfo: buildInfo(),
    mode: settings.mode ?? "auto",
    account: settings.account ?? null,
    character: currentCharacter
      ? {
          name: currentCharacter.name,
          level: currentCharacter.level,
          league: currentCharacter.league,
          className: currentCharacter.className,
          fromLog: currentCharacter.name === settings.logCharacter,
        }
      : null,
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
    const body = JSON.parse(await readBody(req)) as { url?: string; mode?: "auto" | "manual" };
    const mode = body.mode ?? settings.mode ?? "auto";
    const link = body.url?.trim() ?? "";
    if (mode === "auto") {
      // the account is enough: a profile or a character link both work
      const account = parseAccount(link) ?? link.replace(/#/g, "-");
      if (!account || /[\s/]/.test(account)) return { ...status(), error: "bad-profile-url" };
      settings.account = account;
      characters = null;
    } else {
      if (!parseProfileUrl(link)) return { ...status(), error: "bad-profile-url" };
      settings.profileUrl = link;
      settings.account = parseAccount(link) ?? settings.account;
    }
    settings.mode = mode;
    settings.skill = undefined;
    settings.fetchedAt = undefined;
    saveSettings();
    buildSummary = null;
    currentCharacter = null;
    await ensureBuild(logger, true);
    return status();
  }
  if (url.startsWith("/atziri-pob/source") && req.method === "POST") {
    const body = JSON.parse(await readBody(req)) as { source?: string; build?: string | null };
    if (body.source === "pob" || body.source === "ninja") settings.source = body.source;
    if (body.build !== undefined) {
      // only a build of the Path of Building folder (null: the last saved one)
      const known = listPobBuilds().some((b) => b.file === body.build);
      settings.pobBuild = body.build && known ? body.build : undefined;
    }
    saveSettings();
    buildSummary = null;
    loadedKey = null;
    await ensureBuild(logger);
    return status();
  }
  if (url.startsWith("/atziri-pob/hint") && req.method === "POST") {
    // the game log shows which character is being played
    const { name, level, className } = JSON.parse(await readBody(req)) as {
      name?: string;
      level?: number;
      className?: string;
    };
    // level-up of the played character (shown on Discord)
    if (name && typeof level === "number" && level > 0) {
      settings.logLevel = { name, level, className };
      saveSettings();
    }
    if (name && name !== settings.logCharacter) {
      settings.logCharacter = name;
      saveSettings();
      if (settings.source === "ninja" && settings.mode === "auto" && name !== currentCharacter?.name) {
        characters = null; // the new character may be missing from the cached list
        // load the new build now, so the next comparison is quick
        ensureBuild(logger).catch(() => {});
      }
    }
    return { ok: true };
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
      return { ...loaded, build: buildInfo() };
    }
    const answer = await ask(logger, { cmd: "compare", item }, COMPARE_TIMEOUT_MS);
    rememberComparison(item, answer);
    // the card shows from now on
    openCard();
    return { ...answer, build: buildInfo() };
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

/**
 * A build saved in Path of Building (after "Import" from the official site)
 * is loaded right away, so the next comparison is quick and up to date
 */
function watchPobBuilds(logger: Logger) {
  const dir = pobBuildsDir();
  let timer: NodeJS.Timeout | null = null;
  try {
    fs.mkdirSync(dir, { recursive: true });
    const watcher = fs.watch(dir, { recursive: true }, (_event, name) => {
      if (!name?.toLowerCase().endsWith(".xml")) return;
      if (timer) clearTimeout(timer);
      // Path of Building writes the file in several steps
      timer = setTimeout(() => {
        if (settings.source !== "pob" || !engine) return;
        ensureBuild(logger).catch(() => {});
      }, 1500);
    });
    watcher.on("error", () => {});
    app.on("will-quit", () => { watcher.close(); });
  } catch (e) {
    logger.write(`warn [PoB] cannot watch ${dir}: ${(e as Error).message}`);
  }
}

/** Routes /atziri-pob/* used by the overlay page */
export function setupAtziriPob(server: Server, logger: Logger) {
  loadSettings();
  app.on("will-quit", stopEngine);
  closeCardOnInput();
  watchPobBuilds(logger);

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
