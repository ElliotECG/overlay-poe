// My Ritualist Overlay: shows on Discord that the overlay is being used
// ("Rich Presence": "Playing My Ritualist Overlay", with the character).
//
// Talks to the Discord app running on this PC through its local pipe
// (\\?\pipe\discord-ipc-N): nothing goes over the network from here, and no
// Discord account or token is involved. The "application" (its name, its
// "ritualist" image) is the one created in the Discord Developer Portal; its
// id is public.
import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import type { Server, IncomingMessage, ServerResponse } from "http";
import type { Logger } from "./RemoteLogger";

const CLIENT_ID = "1569168077306986566";
const PROJECT_URL = "https://github.com/ElliotECG/overlay-poe";
// Discord allows 5 activity updates per 20 s: one check every 15 s is plenty
const TICK_MS = 15_000;

const OP_HANDSHAKE = 0;
const OP_FRAME = 1;
const OP_CLOSE = 2;
const OP_PING = 3;
const OP_PONG = 4;

export interface DiscordCharacter {
  /** shown class name */
  className?: string;
  /** English ascendancy (or class), for its picture, e.g. "Ritualist" */
  ascendancy?: string;
  level?: number;
}

export interface DiscordContext {
  isGameOpen: () => boolean;
  /** the character being played, if known */
  character: () => DiscordCharacter | null;
  /** league chosen in the overlay, e.g. "Forbidden Rites" */
  league: () => string | null;
}

interface Activity {
  details: string;
  state: string;
  timestamps: { start: number };
  assets: {
    large_image: string;
    large_text: string;
    small_image?: string;
    small_text?: string;
  };
  buttons: Array<{ label: string; url: string }>;
}

// Overlay icon uploaded in the Discord Developer Portal ("Art Assets")
const APP_IMAGE = "ritualist";

/**
 * Picture of an ascendancy or class: the ones poe.ninja shows on its build
 * pages ("Blood Mage" -> .../blood-mage.webp). Discord loads images given as
 * an https address itself.
 */
export function ascendancyImage(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `https://assets.poe.ninja/poe2/classes/${slug}.webp`;
}

/** Discord wants 2 to 128 characters per line */
function line(text: string) {
  return text.length > 128 ? text.slice(0, 127) + "…" : text.padEnd(2, " ");
}

/** What Discord shows under "Playing My Ritualist Overlay" */
export function buildActivity(
  gameOpen: boolean,
  character: DiscordCharacter | null,
  league: string | null,
  startedAt: number,
): Activity {
  const who = [
    character?.className,
    character?.level ? `niv. ${character.level}` : undefined,
  ].filter(Boolean).join(" ");
  // "Ritualist niv. 90 · Forbidden Rites"
  const details = [who, league].filter(Boolean).join(" · ") || "Path of Exile 2";
  const state = gameOpen ? "En jeu sur Path of Exile 2" : "Hors jeu · consulte le marché";

  // the overlay's Ritualist picture in big, the played ascendancy in the corner
  const assets: Activity["assets"] = {
    large_image: APP_IMAGE,
    large_text: "My Ritualist Overlay",
    ...(character?.ascendancy
      ? {
          small_image: ascendancyImage(character.ascendancy),
          small_text: who || character.ascendancy,
        }
      : {}),
  };

  return {
    details: line(details),
    state: line(state),
    timestamps: { start: Math.floor(startedAt / 1000) },
    assets,
    buttons: [{ label: "Voir l'overlay", url: PROJECT_URL }],
  };
}

// --------------------------------------------- league chosen in the overlay

let leagueCache: { mtimeMs: number; league: string | null } | null = null;

/** League picked in the hub (leagueId of the saved settings), e.g. "Forbidden Rites" */
export function overlayLeague(): string | null {
  const file = path.join(app.getPath("userData"), "apt-data", "config.json");
  try {
    const { mtimeMs } = fs.statSync(file);
    if (leagueCache?.mtimeMs !== mtimeMs) {
      const id = (JSON.parse(fs.readFileSync(file, "utf8")) as { leagueId?: unknown }).leagueId;
      leagueCache = { mtimeMs, league: typeof id === "string" && id.trim() ? id.trim() : null };
    }
    return leagueCache.league;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- settings

const settingsFile = () => path.join(app.getPath("userData"), "discord.json");

function loadEnabled(): boolean {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), "utf8")).enabled !== false;
  } catch {
    return true; // on by default
  }
}

function saveEnabled(enabled: boolean) {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify({ enabled }));
  } catch {
    // not important
  }
}

// ----------------------------------------------------- the Discord pipe

export class DiscordPipe {
  private socket: net.Socket | null = null;
  private buffer = Buffer.alloc(0);
  private nonce = 0;
  ready = false;

  constructor(
    private onReady: () => void,
    /** Discord refused a command (e.g. a wrong activity) */
    private onError: (message: string) => void = () => {},
  ) {}

  get connected() {
    return this.socket != null;
  }

  /** Tries the pipes Discord may listen on (several Discord apps: 0, 1...) */
  async connect(): Promise<boolean> {
    for (let i = 0; i < 10; i++) {
      const socket = await new Promise<net.Socket | null>((resolve) => {
        const s = net.createConnection(`\\\\?\\pipe\\discord-ipc-${i}`);
        s.once("connect", () => { resolve(s); });
        s.once("error", () => { resolve(null); });
      });
      if (!socket) continue;
      this.socket = socket;
      this.buffer = Buffer.alloc(0);
      socket.on("data", (chunk: Buffer) => { this.read(chunk); });
      socket.on("close", () => { this.reset(); });
      socket.on("error", () => { this.reset(); });
      this.write(OP_HANDSHAKE, { v: 1, client_id: CLIENT_ID });
      return true;
    }
    return false;
  }

  setActivity(activity: Activity | null) {
    if (!this.ready) return;
    this.write(OP_FRAME, {
      cmd: "SET_ACTIVITY",
      args: activity ? { pid: process.pid, activity } : { pid: process.pid },
      nonce: String(++this.nonce),
    });
  }

  close() {
    this.socket?.destroy();
    this.reset();
  }

  private reset() {
    this.socket = null;
    this.ready = false;
  }

  private write(op: number, payload: unknown) {
    if (!this.socket) return;
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    const header = Buffer.alloc(8);
    header.writeInt32LE(op, 0);
    header.writeInt32LE(body.length, 4);
    this.socket.write(Buffer.concat([header, body]));
  }

  private read(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 8) {
      const op = this.buffer.readInt32LE(0);
      const length = this.buffer.readInt32LE(4);
      if (this.buffer.length < 8 + length) return;
      const text = this.buffer.subarray(8, 8 + length).toString("utf8");
      this.buffer = this.buffer.subarray(8 + length);
      let payload: { evt?: string; data?: { message?: string } } = {};
      try {
        payload = JSON.parse(text);
      } catch {
        continue;
      }
      if (op === OP_PING) this.write(OP_PONG, payload);
      else if (op === OP_CLOSE) this.close();
      else if (op === OP_FRAME && payload.evt === "READY") {
        this.ready = true;
        this.onReady();
      } else if (op === OP_FRAME && payload.evt === "ERROR") {
        this.onError(payload.data?.message ?? "unknown error");
      }
    }
  }
}

// ----------------------------------------------------------- the loop

export function setupAtziriDiscord(server: Server, logger: Logger, ctx: DiscordContext) {
  let enabled = loadEnabled();
  const startedAt = Date.now();
  let lastSent = "";
  let connecting = false;

  const pipe = new DiscordPipe(
    () => {
      logger.write("info [Discord] connected: the overlay shows on your Discord profile.");
      lastSent = "";
      update();
    },
    (message) => {
      logger.write(`warn [Discord] ${message}`);
    },
  );

  function update() {
    if (!pipe.ready) return;
    const activity = enabled
      ? buildActivity(ctx.isGameOpen(), ctx.character(), ctx.league(), startedAt)
      : null;
    const key = JSON.stringify(activity);
    if (key === lastSent) return;
    lastSent = key;
    pipe.setActivity(activity);
  }

  async function tick() {
    if (!enabled) return;
    if (!pipe.connected && !connecting) {
      // Discord not started yet (or restarted): try again at the next tick
      connecting = true;
      try {
        await pipe.connect();
      } finally {
        connecting = false;
      }
      return;
    }
    update();
  }

  setInterval(() => { tick().catch(() => {}); }, TICK_MS);
  tick().catch(() => {});
  app.on("will-quit", () => { pipe.close(); });

  server.prependListener("request", (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "";
    if (!url.startsWith("/atziri-discord")) return;
    (req as IncomingMessage & { atziriHandled?: boolean }).atziriHandled = true;
    if (req.method === "POST") {
      enabled = !url.includes("on=0");
      saveEnabled(enabled);
      if (enabled) {
        tick().catch(() => {});
      } else {
        // removes the activity, then lets Discord go
        update();
        setTimeout(() => { pipe.close(); }, 500);
      }
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ enabled, connected: pipe.ready }));
  });
}
