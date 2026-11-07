// Atziri Exchange: history of price checks (Ctrl + D) and farming sessions
import { shallowRef, watch } from "vue";
import type { ParsedItem } from "@/parser";
import { getDetailsId } from "@/web/price-check/trends/getDetailsId";
import { Host } from "@/web/background/IPC";

export interface HistoryEntry {
  id: number;
  at: number;
  name: string;
  icon?: string;
  rarity?: string;
  count: number;
  query?: { ns: string; name: string; variant?: string };
  rawText: string;
  sessionId?: number;
}

export interface FarmSession {
  id: number;
  label: string;
  start: number;
  end?: number;
}

const HISTORY_KEY = "atziri-history";
const SESSIONS_KEY = "atziri-sessions";
const MAX_HISTORY = 100;

function load<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore unavailable storage
  }
}

export const history = shallowRef<HistoryEntry[]>(load(HISTORY_KEY, []));
export const sessions = shallowRef<FarmSession[]>(load(SESSIONS_KEY, []));

watch(history, (v) => save(HISTORY_KEY, v));
watch(sessions, (v) => save(SESSIONS_KEY, v));

export function activeSession(): FarmSession | undefined {
  return sessions.value.find((s) => s.end == null);
}

/** Called for every successful price check */
export function recordPriceCheck(item: ParsedItem, rawText: string) {
  let query: HistoryEntry["query"];
  try {
    const q = getDetailsId(item);
    if (q) query = { ns: q.ns, name: q.name, variant: q.variant };
  } catch {
    // no poe.ninja price for this item
  }
  const entry: HistoryEntry = {
    id: Date.now(),
    at: Date.now(),
    name: item.info.name,
    icon: item.info.icon,
    rarity: item.rarity,
    count: item.stackSize?.value ?? 1,
    query,
    rawText,
    sessionId: activeSession()?.id,
  };
  history.value = [entry, ...history.value].slice(0, MAX_HISTORY);
}

export function clearHistory() {
  const active = activeSession();
  // keep the items of the running session so its total stays right
  history.value = active
    ? history.value.filter((e) => e.sessionId === active.id)
    : [];
}

/** Opens the price check again for an item of the history */
export function recheck(entry: HistoryEntry) {
  Host.selfDispatch({
    name: "MAIN->CLIENT::item-text",
    payload: {
      target: "price-check",
      clipboard: entry.rawText,
      position: {
        x: window.screenX + window.innerWidth / 2,
        y: window.screenY + window.innerHeight / 2,
      },
      focusOverlay: true,
      atziriRecheck: true,
    },
  });
}

export function startSession(label: string) {
  stopSession();
  sessions.value = [
    { id: Date.now(), label: label.trim() || "Session", start: Date.now() },
    ...sessions.value,
  ].slice(0, 30);
}

export function stopSession() {
  const active = activeSession();
  if (!active) return;
  sessions.value = sessions.value.map((s) =>
    s.id === active.id ? { ...s, end: Date.now() } : s,
  );
}

export function deleteSession(id: number) {
  sessions.value = sessions.value.filter((s) => s.id !== id);
}
