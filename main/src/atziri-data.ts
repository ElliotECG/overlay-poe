// Atziri Exchange: automatic update of the item and mod lists.
//
// The lists (items.ndjson, stats.ndjson) are published by the Exiled Exchange 2
// authors on GitHub and refreshed for every league. When the overlay asks for
// a language's lists, the app checks GitHub in the background (at most once a
// day), validates the new files, builds their search indexes (same format as
// renderer/src/assets/make-index-files.mjs) and keeps them in its data folder.
// Validated updates are used from the next launch; anything wrong falls back
// to the lists bundled with the app.
import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import type { Server, IncomingMessage, ServerResponse } from "http";
import type { Logger } from "./RemoteLogger";

const SOURCE =
  "https://raw.githubusercontent.com/Kvan7/Exiled-Exchange-2/master/renderer/public/data";
const NDJSON_FILES = ["items.ndjson", "stats.ndjson"] as const;
const INDEX_FILES = [
  "items-name.index.bin",
  "items-ref.index.bin",
  "stats-ref.index.bin",
  "stats-matcher.index.bin",
] as const;
const ALL_FILES: readonly string[] = [...NDJSON_FILES, ...INDEX_FILES];
const LANGUAGES = ["en", "ru", "cmn-Hant", "ko", "ja", "de", "es", "pt", "fr"];
// game patches can change the lists any day: check every 3 hours
const CHECK_EVERY_MS = 3 * 60 * 60 * 1000;
const UPSTREAM_RELEASES =
  "https://api.github.com/repos/Kvan7/Exiled-Exchange-2/releases/latest";

// Atziri Exchange's own releases (number of the build in this installer;
// raise it with every new release: tag "v0.16.3-atziri.2", "...atziri.3"...)
export const ATZIRI_BUILD = 1;
const ATZIRI_RELEASES =
  "https://api.github.com/repos/kinetrex123-boop/atziri-exchange/releases/latest";

/** "v0.16.3-atziri.2" -> 2, "v0.16.3-atziri" -> 1 */
function atziriBuildOf(tag: string): number | undefined {
  const m = /atziri(?:[.-]?(\d+))?/i.exec(tag);
  if (!m) return undefined;
  return m[1] ? parseInt(m[1], 10) : 1;
}

interface AtziriRelease {
  build: number;
  url: string;
  checkedAt: number;
}

interface Upstream {
  version: string; // latest Exiled Exchange 2 release, e.g. "0.16.4"
  url: string;
  checkedAt: number;
}

interface LangState {
  updatedAt: number; // when the cached lists were installed
  items: number; // number of item lines
  stats: number; // number of mod lines
  etags: Record<string, string>;
}

interface State {
  enabled: boolean;
  lastCheck: Record<string, number>;
  langs: Record<string, LangState>;
  lastError?: string;
  upstream?: Upstream;
  atziri?: AtziriRelease;
}

const cacheDir = () => path.join(app.getPath("userData"), "atziri-data");
const stateFile = () => path.join(cacheDir(), "state.json");

let state: State = { enabled: true, lastCheck: {}, langs: {} };
let checking = false;

function loadState() {
  try {
    state = { ...state, ...JSON.parse(fs.readFileSync(stateFile(), "utf8")) };
  } catch {
    // first launch
  }
}

function saveState() {
  fs.mkdirSync(cacheDir(), { recursive: true });
  fs.writeFileSync(stateFile(), JSON.stringify(state, null, 2));
}

/** FNV-1a 32 bits over the UTF-8 bytes, like @sindresorhus/fnv1a */
function fnv1a32(str: string): number {
  let hash = 0x811c9dc5;
  for (const byte of Buffer.from(str, "utf8")) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function writeIndex(
  file: string,
  entries: Array<{ hash: number; start: number }>,
) {
  entries.sort((a, b) => a.hash - b.hash);
  const data = new Uint32Array(entries.length * 2);
  entries.forEach((e, i) => {
    data[i * 2] = e.hash;
    data[i * 2 + 1] = e.start;
  });
  fs.writeFileSync(file, Buffer.from(data.buffer));
}

/** Parses an ndjson file, throws when a line is not valid */
function parseLines(text: string, check: (o: any) => boolean) {
  if (!text.endsWith("\n")) throw new Error("missing final newline");
  const out: Array<{ start: number; obj: any }> = [];
  let start = 0;
  while (start !== text.length) {
    const end = text.indexOf("\n", start);
    const obj = JSON.parse(text.slice(start, end));
    if (!check(obj)) throw new Error(`invalid line at ${start}`);
    out.push({ start, obj });
    start = end + 1;
  }
  return out;
}

function countLines(file: string): number {
  try {
    const text = fs.readFileSync(file, "utf8");
    return text.split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

function bundledFile(lang: string, file: string) {
  return path.join(__dirname, "data", lang, file);
}

function cachedFile(lang: string, file: string) {
  return path.join(cacheDir(), lang, file);
}

function hasCompleteCache(lang: string) {
  return (
    state.langs[lang] != null &&
    ALL_FILES.every((f) => fs.existsSync(cachedFile(lang, f)))
  );
}

async function download(url: string, etag?: string) {
  const res = await fetch(url, {
    headers: etag ? { "If-None-Match": etag } : {},
  });
  if (res.status === 304) return { notModified: true as const };
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return {
    notModified: false as const,
    text: await res.text(),
    etag: res.headers.get("etag") ?? undefined,
  };
}

/** Checks GitHub for newer lists of one language and installs them */
async function updateLanguage(lang: string, logger: Logger, force = false) {
  if (!LANGUAGES.includes(lang)) return;
  const now = Date.now();
  if (!force && now - (state.lastCheck[lang] ?? 0) < CHECK_EVERY_MS) return;
  state.lastCheck[lang] = now;

  const prev = state.langs[lang];
  const items = await download(`${SOURCE}/${lang}/items.ndjson`, force ? undefined : prev?.etags["items.ndjson"]);
  const stats = await download(`${SOURCE}/${lang}/stats.ndjson`, force ? undefined : prev?.etags["stats.ndjson"]);
  if (items.notModified && stats.notModified) {
    saveState();
    return;
  }

  // get the full text of both files (one may be "not modified")
  const itemsText = items.notModified
    ? fs.readFileSync(cachedFile(lang, "items.ndjson"), "utf8")
    : items.text;
  const statsText = stats.notModified
    ? fs.readFileSync(cachedFile(lang, "stats.ndjson"), "utf8")
    : stats.text;

  // validate: every line well formed, and no big loss compared to the bundle
  // (some bundled entries legitimately have no name, only a namespace)
  const itemLines = parseLines(
    itemsText,
    (o) => o != null && typeof o === "object" && typeof o.namespace === "string",
  );
  const statLines = parseLines(
    statsText,
    (o) => typeof o.ref === "string" && Array.isArray(o.matchers),
  );
  const minItems = countLines(bundledFile(lang, "items.ndjson")) * 0.9;
  const minStats = countLines(bundledFile(lang, "stats.ndjson")) * 0.9;
  if (itemLines.length < minItems || statLines.length < minStats) {
    throw new Error(
      `${lang}: lists too short (${itemLines.length} items, ${statLines.length} mods)`,
    );
  }

  // same content as the lists bundled with the app: nothing to install
  const sameAsBundle =
    itemsText === fs.readFileSync(bundledFile(lang, "items.ndjson"), "utf8") &&
    statsText === fs.readFileSync(bundledFile(lang, "stats.ndjson"), "utf8");

  const etags = {
    "items.ndjson": items.notModified ? prev?.etags["items.ndjson"] ?? "" : items.etag ?? "",
    "stats.ndjson": stats.notModified ? prev?.etags["stats.ndjson"] ?? "" : stats.etag ?? "",
  };

  if (sameAsBundle) {
    removeLanguage(lang);
    state.langs = Object.fromEntries(
      Object.entries(state.langs).filter(([l]) => l !== lang),
    );
    saveState();
    return;
  }

  // build in a temporary folder, then swap
  const tmp = path.join(cacheDir(), `${lang}.tmp`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, "items.ndjson"), itemsText);
  fs.writeFileSync(path.join(tmp, "stats.ndjson"), statsText);

  const statsByRef: Array<{ hash: number; start: number }> = [];
  const matchers: Array<{ hash: number; start: number }> = [];
  for (const { start, obj } of statLines) {
    statsByRef.push({ start, hash: fnv1a32(obj.ref) });
    for (const m of obj.matchers) {
      matchers.push({ start, hash: fnv1a32(m.string) });
      if (m.advanced) matchers.push({ start, hash: fnv1a32(m.advanced) });
    }
  }
  writeIndex(path.join(tmp, "stats-ref.index.bin"), statsByRef);
  writeIndex(path.join(tmp, "stats-matcher.index.bin"), matchers);

  const byName = new Map<string, { hashName: number; hashRef: number; start: number }>();
  for (const { start, obj } of itemLines) {
    const key = `${obj.namespace}::${obj.refName}`;
    if (!byName.has(key)) {
      byName.set(key, {
        hashName: fnv1a32(`${obj.namespace}::${obj.name}`),
        hashRef: fnv1a32(key),
        start,
      });
    }
  }
  const entries = Array.from(byName.values());
  writeIndex(
    path.join(tmp, "items-name.index.bin"),
    entries.map((e) => ({ hash: e.hashName, start: e.start })),
  );
  writeIndex(
    path.join(tmp, "items-ref.index.bin"),
    entries.map((e) => ({ hash: e.hashRef, start: e.start })),
  );

  removeLanguage(lang);
  fs.renameSync(tmp, path.join(cacheDir(), lang));
  state.langs[lang] = {
    updatedAt: Date.now(),
    items: itemLines.length,
    stats: statLines.length,
    etags,
  };
  saveState();
  logger.write(
    `info [Atziri data] ${lang}: new item/mod lists installed (${itemLines.length} items, ${statLines.length} mods), used from next launch.`,
  );
}

function removeLanguage(lang: string) {
  fs.rmSync(path.join(cacheDir(), lang), { recursive: true, force: true });
}

/** "0.16.10" > "0.16.9" */
function isNewer(a: string, b: string) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

/**
 * Looks for a new Exiled Exchange 2 release. Its code changes (item parser,
 * new item types) cannot be merged automatically into this fork, so the
 * settings and the Shift + Space page only say that one is available.
 */
async function checkUpstream(logger: Logger, force = false) {
  const now = Date.now();
  if (!force && state.upstream && now - state.upstream.checkedAt < CHECK_EVERY_MS) return;
  try {
    const res = await fetch(UPSTREAM_RELEASES, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const rel = (await res.json()) as { tag_name?: string; html_url?: string };
    const version = (rel.tag_name ?? "").replace(/^v/i, "");
    if (!/^\d+(\.\d+)*$/.test(version)) return;
    state.upstream = {
      version,
      url: typeof rel.html_url === "string" && rel.html_url.startsWith("https://github.com/")
        ? rel.html_url
        : "https://github.com/Kvan7/Exiled-Exchange-2/releases",
      checkedAt: now,
    };
    if (isNewer(version, app.getVersion())) {
      logger.write(`info [Atziri data] Exiled Exchange 2 ${version} is available (this build: ${app.getVersion()}).`);
    }
  } catch (e) {
    logger.write(`warn [Atziri data] release check failed: ${(e as Error).message}`);
  }
}

/** Looks for a newer Atziri Exchange installer on its GitHub Releases page */
async function checkAtziriRelease(logger: Logger, force = false) {
  const now = Date.now();
  if (!force && state.atziri && now - state.atziri.checkedAt < CHECK_EVERY_MS) return;
  try {
    const res = await fetch(ATZIRI_RELEASES, {
      headers: { Accept: "application/vnd.github+json" },
    });
    // 404 while the repository is private: nothing to report
    if (!res.ok) return;
    const rel = (await res.json()) as { tag_name?: string; html_url?: string };
    const build = atziriBuildOf(rel.tag_name ?? "");
    if (build == null) return;
    state.atziri = {
      build,
      url:
        typeof rel.html_url === "string" &&
        rel.html_url.startsWith("https://github.com/kinetrex123-boop/atziri-exchange/")
          ? rel.html_url
          : "https://github.com/kinetrex123-boop/atziri-exchange/releases/latest",
      checkedAt: now,
    };
    if (build > ATZIRI_BUILD) {
      logger.write(`info [Atziri] a new Atziri Exchange version is available (build ${build}).`);
    }
  } catch (e) {
    logger.write(`warn [Atziri] release check failed: ${(e as Error).message}`);
  }
}

async function runChecks(langs: string[], logger: Logger, force = false) {
  if (checking) return;
  checking = true;
  try {
    await checkUpstream(logger, force);
    await checkAtziriRelease(logger, force);
    for (const lang of new Set(langs)) {
      try {
        await updateLanguage(lang, logger, force);
        state.lastError = undefined;
      } catch (e) {
        state.lastError = `${lang}: ${(e as Error).message}`;
        logger.write(`warn [Atziri data] ${state.lastError}`);
      }
    }
    saveState();
  } finally {
    checking = false;
  }
}

// languages the overlay actually loaded during this launch
const requestedLangs = new Set<string>(["en"]);
// cache folders used for this launch (decided once, so files stay consistent)
const servedFromCache = new Map<string, boolean>();

/**
 * Returns the file to serve for /data/<lang>/<file>: the updated list when one
 * is installed and enabled, otherwise undefined (bundled file).
 */
function resolveDataFile(url: string, logger: Logger): string | undefined {
  const m = /^\/data\/([^/]+)\/([^/?]+)/.exec(url);
  if (!m) return undefined;
  const [, lang, file] = m;
  if (!ALL_FILES.includes(file)) return undefined;

  if (!requestedLangs.has(lang)) {
    requestedLangs.add(lang);
    // check in the background a bit after start-up
    setTimeout(async () => { await runChecks([...requestedLangs], logger); }, 15_000);
  }

  if (!servedFromCache.has(lang)) {
    servedFromCache.set(lang, state.enabled && hasCompleteCache(lang));
  }
  return servedFromCache.get(lang) ? cachedFile(lang, file) : undefined;
}

function sendJson(res: ServerResponse, body: unknown) {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function status() {
  const up = state.upstream;
  return {
    appVersion: app.getVersion(),
    atziriBuild: ATZIRI_BUILD,
    atziriUpdate:
      state.atziri && state.atziri.build > ATZIRI_BUILD
        ? { build: state.atziri.build, url: state.atziri.url }
        : null,
    upstream:
      up && isNewer(up.version, app.getVersion())
        ? { version: up.version, url: up.url }
        : null,
    // new lists installed but not used yet by this launch
    pendingApply: Object.keys(state.langs).some(
      (l) => servedFromCache.has(l) && !servedFromCache.get(l) && state.enabled && hasCompleteCache(l),
    ),
    enabled: state.enabled,
    checking,
    lastError: state.lastError ?? null,
    lastCheck: Math.max(0, ...Object.values(state.lastCheck)),
    langs: Object.fromEntries(
      Object.entries(state.langs).map(([lang, s]) => [
        lang,
        { updatedAt: s.updatedAt, items: s.items, stats: s.stats, active: servedFromCache.get(lang) ?? false },
      ]),
    ),
  };
}

/** Serves updated lists and the /atziri-data/* routes used by the settings */
export function setupAtziriData(server: Server, logger: Logger) {
  loadState();
  setTimeout(async () => { await runChecks([...requestedLangs], logger); }, 20_000);
  // keep checking while the app stays open for days
  setInterval(async () => { await runChecks([...requestedLangs], logger); }, CHECK_EVERY_MS);

  server.prependListener("request", (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "";
    if (req.method === "GET" && url.startsWith("/data/")) {
      const file = resolveDataFile(url, logger);
      if (file) {
        (req as IncomingMessage & { atziriHandled?: boolean }).atziriHandled = true;
        fs.createReadStream(file).pipe(res);
      }
      return;
    }
    if (!url.startsWith("/atziri-data/")) return;
    (req as IncomingMessage & { atziriHandled?: boolean }).atziriHandled = true;

    if (url.startsWith("/atziri-data/status")) {
      sendJson(res, status());
    } else if (url.startsWith("/atziri-data/check") && req.method === "POST") {
      runChecks([...requestedLangs], logger, true).then(() => { sendJson(res, status()); });
    } else if (url.startsWith("/atziri-data/reset") && req.method === "POST") {
      for (const lang of LANGUAGES) removeLanguage(lang);
      state.langs = {};
      state.lastCheck = {};
      saveState();
      sendJson(res, status());
    } else if (url.startsWith("/atziri-data/apply") && req.method === "POST") {
      // restart the app so every window uses the new lists
      sendJson(res, { ok: true });
      setTimeout(() => {
        app.relaunch();
        app.quit(); // goes through will-quit, which stops the keyboard hook
      }, 300);
    } else if (url.startsWith("/atziri-data/enable") && req.method === "POST") {
      state.enabled = !url.includes("on=0");
      saveState();
      sendJson(res, status());
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
}
