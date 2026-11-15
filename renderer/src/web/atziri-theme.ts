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
  injectEditorialPalette();
}

// --------------------------------------------- Virtual Hideout (editorial)

/**
 * The art direction of the home page, for the whole hub and the settings:
 * paper white, ink black, graphite text, and the violet of the ritual smoke.
 * The in-game windows (price check, Path of Building card) keep the theme
 * above: a white window over a dark game would dazzle.
 */
export const EDITORIAL = {
  paper: "#f4f3f6",
  sheet: "#ffffff",
  rule: "#e2e0e7",
  ink: "#111014",
  graphite: "#5f5c6b",
  violet: "#6b3fd1",
};

/** The gray and blue scales of a light page: lower numbers are darker */
function editorialScales(): Record<string, RGB> {
  const paper = toRgb(EDITORIAL.paper);
  const sheet = toRgb(EDITORIAL.sheet);
  const rule = toRgb(EDITORIAL.rule);
  const ink = toRgb(EDITORIAL.ink);
  const graphite = toRgb(EDITORIAL.graphite);
  const violet = toRgb(EDITORIAL.violet);
  return {
    "gray-900": paper,
    "gray-800": sheet,
    "gray-700": rule,
    "gray-600": mix(rule, graphite, 0.45),
    "gray-500": mix(rule, graphite, 0.75),
    "gray-400": graphite,
    "gray-300": mix(graphite, ink, 0.5),
    "gray-200": ink,
    "gray-100": mix(ink, BLACK, 0.4),
    // on paper the light tints are the soft ones, the dark tints the strong ones
    "blue-100": mix(violet, BLACK, 0.45),
    "blue-200": mix(violet, BLACK, 0.3),
    "blue-300": mix(violet, BLACK, 0.15),
    "blue-400": violet,
    "blue-500": mix(violet, BLACK, 0.12),
    "blue-600": mix(violet, BLACK, 0.27),
    "blue-700": mix(violet, paper, 0.55),
    "blue-800": mix(violet, paper, 0.75),
    "blue-900": mix(violet, paper, 0.88),
  };
}

/**
 * Style of the windows opened over the game (price check, Path of Building
 * card...): "editorial", like the home page, or "theme", the dark colors
 * above (less bright over a dark game). Remembered on this PC.
 */
export type IngameStyle = "editorial" | "theme";
const INGAME_KEY = "atz-ingame-style";

function loadIngameStyle(): IngameStyle {
  try {
    return localStorage.getItem(INGAME_KEY) === "theme" ? "theme" : "editorial";
  } catch {
    return "editorial";
  }
}

export const ingameStyle = shallowRef<IngameStyle>(loadIngameStyle());

export function setIngameStyle(style: IngameStyle) {
  ingameStyle.value = style;
  try {
    localStorage.setItem(INGAME_KEY, style);
  } catch {
    // ignore unavailable storage
  }
}

// another window of the app (overlay / desktop) changed it
window.addEventListener("storage", (e) => {
  if (e.key === INGAME_KEY) ingameStyle.value = loadIngameStyle();
});

/** Pages marked .atz-light use the editorial scales instead of the theme */
function injectEditorialPalette() {
  if (document.getElementById("atz-editorial")) return;
  const vars = Object.entries(editorialScales())
    .map(([name, rgb]) => `--c-${name}: ${rgb.join(" ")};`)
    .join(" ");
  const style = document.createElement("style");
  style.id = "atz-editorial";
  style.textContent = `.atz-light { ${vars} color-scheme: light; }`;
  document.head.appendChild(style);
}
