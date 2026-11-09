// My Ritualist Overlay: "Compare in PoB" (see main/src/atziri-pob.ts).
//
// The item copied in game is in the game's language; Path of Building only
// reads English. The overlay already understands the item (ParsedItem): its
// English base and the English template of every modifier, so the English
// item text is rebuilt from those.
import { shallowRef } from "vue";
import { ItemRarity, type ParsedItem } from "@/parser";
import { ModifierType } from "@/parser/modifiers";
import type { ParsedStat } from "@/parser/stat-translations";
import { Host } from "@/web/background/IPC";

const INNATE_TYPES = new Set<ModifierType>([ModifierType.Implicit]);
const ENCHANT_TYPES = new Set<ModifierType>([
  ModifierType.Enchant,
  ModifierType.Augment,
  ModifierType.AddedAugment,
]);
const SKIPPED_TYPES = new Set<ModifierType>([ModifierType.Pseudo, ModifierType.Skill]);

function formatValue(value: number, decimal: boolean) {
  return decimal ? String(Number(value.toFixed(2))) : String(Math.round(value));
}

/**
 * English line of one stat: its template ("Adds # to # Lightning Damage")
 * filled with the rolled value. Stats with two values ("Adds 1 to 104") are
 * stored as their average by the parser: "Adds 52.5 to 52.5" deals the same
 * average damage, which is what DPS calculations use.
 */
export function statToEnglish(stat: ParsedStat): string | null {
  let text = stat.stat.ref;
  const holes = (text.match(/#/g) ?? []).length;
  if (!holes) return text;
  const roll = stat.roll;
  if (!roll) return null;
  let value = roll.value;
  if (value < 0 && /\b(increased|more)\b/.test(text)) {
    text = text.replace(/\bincreased\b/, "reduced").replace(/\bmore\b/, "less");
    value = -value;
  }
  const decimal = roll.dp || (holes > 1 && !Number.isInteger(value));
  let filled = text.replace(/#/g, formatValue(value, decimal));
  // the templates leave out the "+" of "+57 to Accuracy Rating", which the
  // game always shows and Path of Building requires ("N to ..." lines)
  if (/^#%? to /.test(text) && value >= 0) {
    filled = "+" + filled;
  }
  return filled.replace("+-", "-");
}

const RARITY: Record<ItemRarity, string> = {
  [ItemRarity.Normal]: "NORMAL",
  [ItemRarity.Magic]: "MAGIC",
  [ItemRarity.Rare]: "RARE",
  [ItemRarity.Unique]: "UNIQUE",
};

/** Path of Building item text (English) of an item copied in game */
export function itemToPobText(item: ParsedItem): string | null {
  if (!item.rarity || !item.info) return null;
  const lines = [`Rarity: ${RARITY[item.rarity]}`];
  if (item.rarity === ItemRarity.Unique) {
    lines.push(item.info.refName, item.info.unique?.base ?? item.info.refName);
  } else if (item.rarity === ItemRarity.Rare) {
    lines.push("Overlay Item", item.info.refName);
  } else {
    lines.push(item.info.refName);
  }
  if (item.quality) lines.push(`Quality: ${item.quality}`);
  if (item.itemLevel) lines.push(`Item Level: ${item.itemLevel}`);

  const innate: string[] = [];
  const explicit: string[] = [];
  for (const mod of item.newMods) {
    const type = mod.info.type;
    if (SKIPPED_TYPES.has(type)) continue;
    for (const stat of mod.stats) {
      const line = statToEnglish(stat);
      if (!line) continue;
      if (INNATE_TYPES.has(type)) innate.push(line);
      else if (ENCHANT_TYPES.has(type)) {
        innate.push(`{${type === ModifierType.Enchant ? "enchant" : "rune"}}${line}`);
      } else if (type === ModifierType.Fractured) explicit.push(`{fractured}${line}`);
      else if (type === ModifierType.Desecrated) explicit.push(`{desecrated}${line}`);
      else explicit.push(line);
    }
  }
  lines.push(`Implicits: ${innate.length}`, ...innate, ...explicit);
  if (item.isCorrupted) lines.push("Corrupted");
  return lines.join("\n");
}

// ---------------------------------------------------------- comparison

/** Path of Building output values (see STAT_KEYS in main/pob/pob-server.lua) */
export type PobStats = Partial<Record<string, number>>;

export interface PobSkillDps {
  index: number;
  label: string;
  main: boolean;
  before: number;
  after: number;
}

export interface PobSlotResult {
  slot: string;
  equipped?: string;
  after: PobStats;
  /** DPS of every damaging skill of the build */
  skills?: PobSkillDps[];
}

export interface PobCompareResult {
  ok: boolean;
  error?: string;
  item?: string;
  skill?: string;
  before?: PobStats;
  results?: PobSlotResult[];
  /** modifiers the overlay could not read: the result may be incomplete */
  unknownMods?: number;
  /** modifier lines Path of Building did not understand (ignored) */
  unparsed?: string[];
}

/** Latest comparison, shown by the PoB card of the overlay */
export const pobResult = shallowRef<PobCompareResult | null>(null);
export const pobBusy = shallowRef(false);

export async function compareInPob(item: ParsedItem) {
  await comparePobText(itemToPobText(item), item.unknownModifiers.length);
}

/** Compares an item already written for Path of Building (English) */
export async function comparePobText(text: string | null, unknownMods = 0) {
  if (!text) {
    pobResult.value = { ok: false, error: "unknown-base" };
    return;
  }
  pobBusy.value = true;
  try {
    const res = (await (
      await fetch("/atziri-pob/compare", { method: "POST", body: text })
    ).json()) as PobCompareResult;
    pobResult.value = { ...res, unknownMods };
  } catch (e) {
    pobResult.value = { ok: false, error: (e as Error).message };
  } finally {
    pobBusy.value = false;
  }
}

// ------------------------------------------ character played (game log)

// "2026/11/08 21:36:09 1004763718 3ef232c2 [INFO Client 1157464] : Name ..."
const LOG_LINE = /^(?<datetime>\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \d+ \S+ \[[^\]]*\] : (?<text>.+)$/;
// English and French clients
const LEVEL_UP = /^(?<name>\S+) \([^)]+\) (?:is now level|a atteint le niveau|vient de passer au niveau) \d+\.?$/;
const JOINED = /^(?<name>\S+) (?:has joined the area|a rejoint la zone)\.$/;
// only ever about the player's own character
const OWN_ONLY = /^(?<name>\S+) (?:has received |a reçu |has committed suicide\.|a mis fin à ses jours\.)/;
// lines read again from an old part of the log are ignored
const MAX_LOG_AGE_MS = 5 * 60 * 1000;

const partyMembers = new Set<string>();
let lastHint = "";

function handleLogLine(line: string) {
  const m = LOG_LINE.exec(line);
  if (!m) return;
  const text = m.groups!.text;
  const joined = JOINED.exec(text);
  if (joined) {
    partyMembers.add(joined.groups!.name);
    return;
  }
  // level-ups also show party members: only trust names that never joined
  const name = OWN_ONLY.exec(text)?.groups!.name ?? LEVEL_UP.exec(text)?.groups!.name;
  if (!name || partyMembers.has(name) || name === lastHint) return;
  const at = Date.parse(m.groups!.datetime);
  if (Number.isFinite(at) && Math.abs(Date.now() - at) > MAX_LOG_AGE_MS) return;
  lastHint = name;
  fetch("/atziri-pob/hint", { method: "POST", body: JSON.stringify({ name }) }).catch(() => {});
}

let watching = false;

/** Tells the app which character is played, from the game log (auto mode) */
export function startPobLogWatch() {
  if (watching || !Host.isElectron) return;
  watching = true;
  Host.onEvent("MAIN->CLIENT::game-log", (e) => {
    for (const line of e.lines) handleLogLine(line);
  });
}

/** Main DPS figure: DPS of the main skill, with damage over time */
export function dpsOf(stats?: PobStats) {
  if (!stats) return 0;
  return stats.CombinedDPS || stats.TotalDPS || 0;
}
