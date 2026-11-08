// Atziri Exchange: "Death Recap" with NVIDIA Instant Replay.
//
// NVIDIA Instant Replay (NVIDIA app) keeps the last minutes of the game on the
// graphics card's own encoder: smooth and free for the game. When the overlay
// page sees a death in the game log (renderer/src/web/overlay/
// atziri-death-recap.ts), it calls /atziri-death/trigger: this file presses
// the "save Instant Replay" shortcut read from the NVIDIA settings, waits for
// the new video in the NVIDIA folder and moves it to Videos\Atziri Death Recap
// (the 10 most recent are kept), from where the Death Recap tab plays it.
//
// Filming the game from the overlay itself was tried first: with the graphics
// card at ~97 % in fights, screen and window capture only got 2-3 frames a
// second.
import { app, shell } from "electron";
import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { uIOhook, UiohookKey } from "uiohook-napi";
import type { Server, IncomingMessage, ServerResponse } from "http";
import type { Logger } from "./RemoteLogger";

const KEEP_CLIPS = 10;
const CLIP_NAME = /^death-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(-\d+)?\.(webm|mp4)$/;
// NVIDIA writes the video a few seconds after the shortcut (longer replays
// take longer); give up after this
const WAIT_FOR_VIDEO_MS = 60_000;
const NVIDIA_KEY = "HKCU\\Software\\NVIDIA Corporation\\Global\\ShadowPlay\\NVSPCAPS";

const clipsDir = () => path.join(app.getPath("videos"), "Atziri Death Recap");

// ------------------------------------------------------------ saved clips

function listClips() {
  let names: string[] = [];
  try {
    names = fs.readdirSync(clipsDir()).filter((n) => CLIP_NAME.test(n));
  } catch {
    return [];
  }
  return names
    .map((name) => {
      const stat = fs.statSync(path.join(clipsDir(), name));
      return { name, size: stat.size, at: stat.mtimeMs };
    })
    .sort((a, b) => b.at - a.at);
}

function pruneClips() {
  for (const clip of listClips().slice(KEEP_CLIPS)) {
    try {
      fs.rmSync(path.join(clipsDir(), clip.name), { force: true });
    } catch {
      // still open in the player: removed on a later death
    }
  }
}

function clipName(at: Date, ext: string) {
  const p = (n: number) => String(n).padStart(2, "0");
  const base =
    `death-${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}_` +
    `${p(at.getHours())}-${p(at.getMinutes())}-${p(at.getSeconds())}`;
  let name = `${base}${ext}`;
  for (let i = 2; fs.existsSync(path.join(clipsDir(), name)); i++) {
    name = `${base}-${i}${ext}`;
  }
  return name;
}

// -------------------------------------------------------- NVIDIA settings

interface NvidiaSettings {
  folder: string;
  /** shortcut as uiohook key codes, last one is the main key */
  keys: number[];
  /** shortcut as text, e.g. "Alt + F10" */
  shortcut: string;
  /** Instant Replay length in seconds */
  replaySeconds: number | null;
}

/** Windows virtual-key code -> [uiohook key, label] */
function vkToKey(vk: number): [number, string] | null {
  if (vk === 0x10) return [UiohookKey.Shift, "Shift"];
  if (vk === 0x11) return [UiohookKey.Ctrl, "Ctrl"];
  if (vk === 0x12) return [UiohookKey.Alt, "Alt"];
  if (vk >= 0x70 && vk <= 0x7b) {
    const name = `F${vk - 0x6f}`;
    return [UiohookKey[name as keyof typeof UiohookKey], name];
  }
  if ((vk >= 0x41 && vk <= 0x5a) || (vk >= 0x30 && vk <= 0x39)) {
    const name = String.fromCharCode(vk);
    return [UiohookKey[name as keyof typeof UiohookKey], name];
  }
  return null;
}

async function readRegistry(): Promise<Record<string, Buffer>> {
  return await new Promise((resolve) => {
    execFile("reg", ["query", NVIDIA_KEY], { windowsHide: true }, (err, stdout) => {
      const values: Record<string, Buffer> = {};
      if (!err) {
        for (const line of stdout.split(/\r?\n/)) {
          const m = /^\s+(\S+)\s+REG_BINARY\s+([0-9A-F]*)$/i.exec(line);
          if (m) values[m[1]] = Buffer.from(m[2], "hex");
        }
      }
      resolve(values);
    });
  });
}

const DEFAULT_SETTINGS = (): NvidiaSettings => ({
  folder: path.join(app.getPath("videos"), "NVIDIA"),
  keys: [UiohookKey.Alt, UiohookKey.F10],
  shortcut: "Alt + F10",
  replaySeconds: null,
});

async function nvidiaSettings(): Promise<NvidiaSettings> {
  const settings = DEFAULT_SETTINGS();
  if (process.platform !== "win32") return settings;
  const reg = await readRegistry();

  const folder = reg.DefaultPathW?.toString("utf16le").replace(/\0+$/, "");
  if (folder) settings.folder = folder;

  const count = reg.DVRHKeyCount?.readUInt32LE(0) ?? 0;
  const keys: Array<[number, string]> = [];
  for (let i = 0; i < count; i++) {
    const vk = reg[`DVRHKey${i}`]?.readUInt32LE(0);
    const key = vk != null ? vkToKey(vk) : null;
    if (!key) {
      keys.length = 0;
      break;
    }
    keys.push(key);
  }
  if (keys.length) {
    settings.keys = keys.map((k) => k[0]);
    settings.shortcut = keys.map((k) => k[1]).join(" + ");
  }

  const len = reg.DVRBufferLen?.readUInt32LE(0);
  if (len) settings.replaySeconds = len;
  return settings;
}

// ---------------------------------------------------------- saving a death

/** Newest .mp4 in the NVIDIA folder (and its game sub-folders) */
function newestVideo(folder: string, since: number): { file: string; size: number } | null {
  let best: { file: string; size: number; at: number } | null = null;
  const visit = (dir: string, depth: number) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && depth < 2) visit(full, depth + 1);
      else if (e.isFile() && /\.mp4$/i.test(e.name)) {
        const stat = fs.statSync(full);
        if (stat.mtimeMs >= since && (!best || stat.mtimeMs > best.at)) {
          best = { file: full, size: stat.size, at: stat.mtimeMs };
        }
      }
    }
  };
  visit(folder, 0);
  return best;
}

const sleep = async (ms: number) => await new Promise((resolve) => setTimeout(resolve, ms));

function moveFile(from: string, to: string) {
  try {
    fs.renameSync(from, to);
  } catch {
    // another drive: copy, then remove the original
    fs.copyFileSync(from, to);
    fs.rmSync(from, { force: true });
  }
}

// NVIDIA Overlay's log, where it writes what happened with the shortcut
const NVIDIA_LOG = () =>
  path.join(process.env.LOCALAPPDATA ?? "", "NVIDIA Corporation", "NVIDIA Overlay", "console.log");
const REPLAY_OFF_MESSAGE = "instant replay while instant replay was disabled";

function fileSize(file: string) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

/** Text added to a file since `start` (bytes) */
function readFrom(file: string, start: number) {
  try {
    const size = fileSize(file);
    if (size <= start) return "";
    const fd = fs.openSync(file, "r");
    try {
      const buf = Buffer.alloc(Math.min(size - start, 256 * 1024));
      fs.readSync(fd, buf, 0, buf.length, start);
      return buf.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return "";
  }
}

let saving = false;

/** Presses the Instant Replay shortcut and moves the new video into our folder */
async function saveInstantReplay(logger: Logger): Promise<{ name?: string; error?: string }> {
  if (saving) return { error: "busy" };
  saving = true;
  try {
    const nv = await nvidiaSettings();
    const logStart = fileSize(NVIDIA_LOG());
    const pressedAt = Date.now();
    const main = nv.keys[nv.keys.length - 1];
    uIOhook.keyTap(main, nv.keys.slice(0, -1));
    logger.write(`info [Death Recap] ${nv.shortcut} pressed (NVIDIA Instant Replay).`);

    // wait for a new video whose size has stopped growing
    let last: { file: string; size: number } | null = null;
    for (let waited = 0; waited < WAIT_FOR_VIDEO_MS; waited += 1000) {
      await sleep(1000);
      // NVIDIA says right away when Instant Replay is off: no need to wait
      if (waited < 5000 && readFrom(NVIDIA_LOG(), logStart).includes(REPLAY_OFF_MESSAGE)) {
        logger.write("warn [Death Recap] NVIDIA Instant Replay is turned off.");
        return { error: "replay-off" };
      }
      const found = newestVideo(nv.folder, pressedAt - 2000);
      if (found && last && found.file === last.file && found.size === last.size && found.size > 0) {
        fs.mkdirSync(clipsDir(), { recursive: true });
        const name = clipName(new Date(pressedAt), ".mp4");
        moveFile(found.file, path.join(clipsDir(), name));
        pruneClips();
        logger.write(`info [Death Recap] clip saved: ${name}`);
        return { name };
      }
      last = found;
    }
    logger.write(`warn [Death Recap] no NVIDIA video appeared in ${nv.folder}.`);
    return { error: "no-video" };
  } catch (e) {
    logger.write(`error [Death Recap] ${(e as Error).message}`);
    return { error: (e as Error).message };
  } finally {
    saving = false;
  }
}

// ------------------------------------------------------------------ routes

function sendJson(res: ServerResponse, body: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

/** Streams a clip, with byte ranges so the video player can seek */
function serveClip(req: IncomingMessage, res: ServerResponse, name: string) {
  if (!CLIP_NAME.test(name)) {
    res.statusCode = 404;
    res.end();
    return;
  }
  const file = path.join(clipsDir(), name);
  let size: number;
  try {
    size = fs.statSync(file).size;
  } catch {
    res.statusCode = 404;
    res.end();
    return;
  }
  res.setHeader("content-type", name.endsWith(".mp4") ? "video/mp4" : "video/webm");
  res.setHeader("accept-ranges", "bytes");
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? parseInt(range[1], 10) : Math.max(0, size - parseInt(range[2], 10));
    const end = range[1] && range[2] ? Math.min(parseInt(range[2], 10), size - 1) : size - 1;
    if (start > end || start >= size) {
      res.statusCode = 416;
      res.setHeader("content-range", `bytes */${size}`);
      res.end();
      return;
    }
    res.statusCode = 206;
    res.setHeader("content-range", `bytes ${start}-${end}/${size}`);
    res.setHeader("content-length", end - start + 1);
    track(name, fs.createReadStream(file, { start, end })).pipe(res);
  } else {
    res.setHeader("content-length", size);
    track(name, fs.createReadStream(file)).pipe(res);
  }
}

// Clips being read by the video player. Windows cannot delete a file that is
// still open, so these reads are closed before a clip is deleted.
const openReads = new Map<string, Set<fs.ReadStream>>();

function track(name: string, stream: fs.ReadStream) {
  let set = openReads.get(name);
  if (!set) openReads.set(name, (set = new Set()));
  set.add(stream);
  stream.on("close", () => set.delete(stream));
  return stream;
}

async function deleteClip(name: string, logger: Logger): Promise<boolean> {
  for (const stream of openReads.get(name) ?? []) stream.destroy();
  const file = path.join(clipsDir(), name);
  // the reads close asynchronously: try again for a few seconds
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      fs.rmSync(file, { force: true });
      return true;
    } catch {
      await sleep(250);
    }
  }
  logger.write(`warn [Death Recap] could not delete ${name} (still open).`);
  return false;
}

/** Routes /atziri-death/* used by the Death Recap tab */
export function setupAtziriDeathRecap(server: Server, logger: Logger) {
  server.prependListener("request", (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "";
    if (!url.startsWith("/atziri-death/")) return;
    (req as IncomingMessage & { atziriHandled?: boolean }).atziriHandled = true;

    if (url.startsWith("/atziri-death/trigger") && req.method === "POST") {
      saveInstantReplay(logger).then((result) => { sendJson(res, result); });
    } else if (url.startsWith("/atziri-death/nvidia") && req.method === "GET") {
      nvidiaSettings().then((nv) => {
        sendJson(res, { folder: nv.folder, shortcut: nv.shortcut, replaySeconds: nv.replaySeconds });
      });
    } else if (url.startsWith("/atziri-death/list") && req.method === "GET") {
      sendJson(res, { clips: listClips().slice(0, KEEP_CLIPS), folder: clipsDir() });
    } else if (url.startsWith("/atziri-death/file/") && req.method === "GET") {
      serveClip(req, res, decodeURIComponent(url.slice("/atziri-death/file/".length).split("?")[0]));
    } else if (url.startsWith("/atziri-death/delete/") && req.method === "POST") {
      const name = decodeURIComponent(url.slice("/atziri-death/delete/".length));
      if (!CLIP_NAME.test(name)) {
        sendJson(res, { ok: false }, 400);
      } else {
        deleteClip(name, logger).then((ok) => {
          sendJson(res, { ok, clips: listClips().slice(0, KEEP_CLIPS) });
        });
      }
    } else if (url.startsWith("/atziri-death/open-folder") && req.method === "POST") {
      fs.mkdirSync(clipsDir(), { recursive: true });
      shell.openPath(clipsDir());
      sendJson(res, { ok: true });
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
}
