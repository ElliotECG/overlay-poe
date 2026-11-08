// Atziri Exchange: "Death Recap" — video of the last seconds before a death.
//
// The video is recorded by NVIDIA Instant Replay (smooth, done by the graphics
// card). When the game log says the character died, the app presses the
// Instant Replay shortcut 2 seconds later (to show the death itself) and moves
// the new video to Videos\Atziri Death Recap (main/src/atziri-death-recap.ts);
// the Death Recap tab then plays its last 17 seconds.
import { shallowRef, watch } from "vue";
import { Host } from "@/web/background/IPC";

/** Seconds shown before the death */
export const SECONDS_BEFORE = 15;
/** The replay is saved this long after the death, to show the death itself */
export const MS_AFTER = 2000;
// deaths read from an old part of the log (re-reading the file) are ignored
const MAX_LOG_AGE_MS = 30_000;
// a second death line right after the first one is the same death
const MIN_GAP_MS = 5_000;

export interface DeathClip {
  name: string;
  size: number;
  at: number;
}

export interface NvidiaInfo {
  folder: string;
  shortcut: string;
  replaySeconds: number | null;
}

const ENABLED_KEY = "atziri-death-recap-enabled";

function loadEnabled() {
  try {
    return localStorage.getItem(ENABLED_KEY) !== "0";
  } catch {
    return true;
  }
}

export const recapEnabled = shallowRef(loadEnabled());
export const recapError = shallowRef<"" | "no-video" | string>("");
export const clips = shallowRef<DeathClip[]>([]);
export const nvidia = shallowRef<NvidiaInfo | null>(null);
/** Deaths recorded since the tab was last opened (badge) */
export const unseenDeaths = shallowRef(0);
/** Clip to show first when the tab opens */
export const latestClip = shallowRef<string | null>(null);
/** A death was detected and its video is being fetched from NVIDIA */
export const savingClip = shallowRef(false);

watch(recapEnabled, (on) => {
  try {
    localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
  } catch {
    // ignore unavailable storage
  }
});

// ------------------------------------------------------------ death detection

// "2026/11/08 21:36:09 1004763718 3ef232c2 [INFO Client 1157464] : Name has been slain."
const LINE_REGEX =
  /^(?<datetime>\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \d+ \S+ \[[^\]]*\] : (?<text>.+)$/;
// English and French game clients
const DEATH_REGEX = /^(?<name>.+?) (?:has been slain|vient de mourir)\.$/;
// players announced as joining the area are party members, not you
const JOIN_REGEX = /^(?<name>.+?) (?:has joined the area|a rejoint la zone)\.$/;

const partyMembers = new Set<string>();
let lastDeathAt = 0;

function handleLogLine(line: string) {
  const m = LINE_REGEX.exec(line);
  if (!m) return;
  const text = m.groups!.text;
  const join = JOIN_REGEX.exec(text);
  if (join) {
    partyMembers.add(join.groups!.name);
    return;
  }
  const death = DEATH_REGEX.exec(text);
  if (!death || partyMembers.has(death.groups!.name)) return;
  const at = Date.parse(m.groups!.datetime);
  if (Number.isFinite(at) && Math.abs(Date.now() - at) > MAX_LOG_AGE_MS) return;
  if (Date.now() - lastDeathAt < MIN_GAP_MS) return;
  lastDeathAt = Date.now();
  if (recapEnabled.value) onDeath();
}

async function onDeath() {
  savingClip.value = true;
  try {
    await new Promise((resolve) => setTimeout(resolve, MS_AFTER));
    const res = (await (
      await fetch("/atziri-death/trigger", { method: "POST" })
    ).json()) as { name?: string; error?: string };
    if (res.name) {
      recapError.value = "";
      latestClip.value = res.name;
      unseenDeaths.value++;
      await refreshClips();
    } else if (res.error && res.error !== "busy") {
      recapError.value = res.error;
    }
  } catch (e) {
    recapError.value = (e as Error).message;
  } finally {
    savingClip.value = false;
  }
}

// ----------------------------------------------------------------- clips API

export async function refreshClips() {
  try {
    const res = (await (await fetch("/atziri-death/list")).json()) as {
      clips: DeathClip[];
    };
    clips.value = res.clips;
  } catch {
    // the app server is not reachable (browser preview)
  }
}

export async function refreshNvidia() {
  try {
    nvidia.value = (await (await fetch("/atziri-death/nvidia")).json()) as NvidiaInfo;
  } catch {
    nvidia.value = null;
  }
}

/** Deletes a clip; false when Windows still had it open */
export async function deleteClip(name: string): Promise<boolean> {
  let ok = false;
  try {
    const res = (await (
      await fetch(`/atziri-death/delete/${encodeURIComponent(name)}`, { method: "POST" })
    ).json()) as { ok?: boolean };
    ok = res.ok === true;
  } catch {
    // app server unreachable
  }
  if (ok && latestClip.value === name) latestClip.value = null;
  await refreshClips();
  return ok;
}

export async function openClipsFolder() {
  await fetch("/atziri-death/open-folder", { method: "POST" });
}

export function clipUrl(name: string) {
  return `/atziri-death/file/${encodeURIComponent(name)}`;
}

let started = false;

/** Called once by the overlay page */
export function startDeathRecap() {
  if (started || !Host.isElectron) return;
  started = true;
  Host.onEvent("MAIN->CLIENT::game-log", (e) => {
    for (const line of e.lines) handleLogLine(line);
  });
  refreshClips();
  refreshNvidia();
}
