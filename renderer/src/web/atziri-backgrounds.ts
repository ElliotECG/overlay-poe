// Atziri Exchange: background images of the Shift + Space page and of the
// price check window. Built-in images, none, or an image imported from the PC
// (stored by the app in its "uploads" folder).
import { shallowRef } from "vue";

export type BgSlot = "hub" | "price";

export const BUILTIN_BACKGROUNDS: Array<{ id: string; label: string; url: string }> = [
  { id: "temple", label: "Temple d'Atziri", url: "/images/atziri-bg.jpg" },
  { id: "reine", label: "Reine Atziri", url: "/images/atziri-reine.jpg" },
];

const DEFAULTS: Record<BgSlot, string> = { hub: "temple", price: "temple" };
const STORAGE_KEY = "atziri-backgrounds";

function load(): Record<BgSlot, string> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object") return { ...DEFAULTS, ...saved };
  } catch {
    // ignore unreadable storage
  }
  return { ...DEFAULTS };
}

/** "temple" | "reine" | "none" | "upload:<file name>" for each slot */
export const backgrounds = shallowRef<Record<BgSlot, string>>(load());

export function backgroundUrl(value: string): string | null {
  if (value === "none") return null;
  if (value.startsWith("upload:")) {
    return `/uploads/${encodeURIComponent(value.slice("upload:".length))}`;
  }
  return BUILTIN_BACKGROUNDS.find((b) => b.id === value)?.url ?? null;
}

function apply() {
  const root = document.documentElement.style;
  for (const slot of ["hub", "price"] as BgSlot[]) {
    const url = backgroundUrl(backgrounds.value[slot]);
    root.setProperty(`--atz-${slot}-bg`, url ? `url("${url}")` : "none");
  }
}

export function setBackground(slot: BgSlot, value: string) {
  backgrounds.value = { ...backgrounds.value, [slot]: value };
  apply();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(backgrounds.value));
  } catch {
    // ignore unavailable storage
  }
}

export function initBackgrounds() {
  apply();
}
