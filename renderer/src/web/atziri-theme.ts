// Atziri Exchange: user-editable overlay colors.
// Six base colors drive the whole interface: the Tailwind "gray" and "blue"
// scales (see tailwind.config.js) are CSS variables computed from them.
import { shallowRef } from "vue";

export interface ThemeColors {
  bg: string; // window backgrounds
  surface: string; // panels
  line: string; // borders
  fg: string; // main text
  muted: string; // secondary text
  accent: string; // highlights (gold by default)
}

// Ritualist themes: the night forest of the Ritualist artwork (indigo
// neutrals, bone text), with one accent each taken from the same scene
const RITUAL_NEUTRALS = {
  bg: "#0b0c16",
  surface: "#151629",
  line: "#2f2d4c",
  fg: "#e6e2d8",
  muted: "#9d99b4",
};

export const THEME_PRESETS: Record<string, { label: string; colors: ThemeColors }> = {
  rituel: {
    label: "Rituel",
    colors: { ...RITUAL_NEUTRALS, accent: "#b57cf0" }, // ritual violet
  },
  cierge: {
    label: "Cierge",
    colors: { ...RITUAL_NEUTRALS, accent: "#e2a554" }, // candle flame
  },
  brume: {
    label: "Brume",
    colors: { ...RITUAL_NEUTRALS, accent: "#8fb0e8" }, // forest mist
  },
  sacrifice: {
    label: "Sacrifice",
    colors: { ...RITUAL_NEUTRALS, accent: "#cf4a5a" }, // blood on the blade
  },
};

export const DEFAULT_THEME = THEME_PRESETS.rituel.colors;
const STORAGE_KEY = "atziri-theme";

// Former Atziri themes: someone still using one of them unchanged moves to
// the Ritualist default; colors they customized are kept
const OLD_PRESET_ACCENTS = ["#d8a24f", "#56c9a6", "#d24b40", "#c3b8e8"];
const OLD_PRESET_BACKGROUNDS = ["#0e0c0a", "#0a1110", "#110909", "#0f0f13"];

export const themeColors = shallowRef<ThemeColors>(loadTheme());

function loadTheme(): ThemeColors {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object") {
      const oldPreset =
        OLD_PRESET_ACCENTS.includes(String(saved.accent).toLowerCase()) &&
        OLD_PRESET_BACKGROUNDS.includes(String(saved.bg).toLowerCase());
      if (!oldPreset) return { ...DEFAULT_THEME, ...saved };
    }
  } catch {
    // ignore unreadable storage
  }
  return { ...DEFAULT_THEME };
}

type RGB = [number, number, number];

function toRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
}

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

function scales(c: ThemeColors): Record<string, RGB> {
  const bg = toRgb(c.bg);
  const surface = toRgb(c.surface);
  const line = toRgb(c.line);
  const fg = toRgb(c.fg);
  const muted = toRgb(c.muted);
  const accent = toRgb(c.accent);
  return {
    "gray-900": bg,
    "gray-800": surface,
    "gray-700": line,
    "gray-600": mix(line, muted, 0.45),
    "gray-500": mix(line, muted, 0.75),
    "gray-400": muted,
    "gray-300": mix(muted, fg, 0.5),
    "gray-200": fg,
    "gray-100": mix(fg, WHITE, 0.4),
    "blue-100": mix(accent, WHITE, 0.82),
    "blue-200": mix(accent, WHITE, 0.6),
    "blue-300": mix(accent, WHITE, 0.32),
    "blue-400": accent,
    "blue-500": mix(accent, BLACK, 0.12),
    "blue-600": mix(accent, BLACK, 0.27),
    "blue-700": mix(accent, BLACK, 0.42),
    "blue-800": mix(accent, bg, 0.6),
    "blue-900": mix(accent, bg, 0.82),
  };
}

/** Applies colors to the whole interface (CSS variables on <html>) */
export function applyTheme(colors: ThemeColors) {
  const root = document.documentElement.style;
  for (const [name, rgb] of Object.entries(scales(colors))) {
    root.setProperty(`--c-${name}`, rgb.join(" "));
  }
}

export function setTheme(colors: ThemeColors) {
  themeColors.value = { ...colors };
  applyTheme(themeColors.value);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(themeColors.value));
  } catch {
    // ignore unavailable storage
  }
}

export function initTheme() {
  applyTheme(themeColors.value);
}
