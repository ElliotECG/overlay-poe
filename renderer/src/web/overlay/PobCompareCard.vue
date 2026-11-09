<template>
  <!-- My Ritualist Overlay: result of "Compare in PoB" (Alt + D on an item) -->
  <transition name="pob-card">
    <div v-if="pobBusy || pobResult" class="pob-card" @click="pobResult = null">
      <div class="pob-head">
        <span class="pob-title">Path of Building</span>
        <span v-if="pobResult?.ok" class="pob-item truncate">{{ itemName(pobResult.item) }}</span>
      </div>

      <div v-if="pobBusy" class="pob-sub">
        <i class="fas fa-spinner fa-spin"></i> {{ tr("Calcul en cours…", "Calculating…") }}
      </div>

      <div v-else-if="pobResult && !pobResult.ok" class="pob-error">
        {{ errorText(pobResult.error) }}
      </div>

      <template v-else-if="pobResult">
        <div v-for="r in pobResult.results" :key="r.slot" class="pob-slot">
          <div class="pob-sub truncate">
            {{ tr("à la place de", "instead of") }}
            <b>{{ itemName(r.equipped) || tr("rien", "nothing") }}</b>
            · {{ slotLabel(r.slot) }}
          </div>

          <!-- main skill, big -->
          <div v-if="unusable(r)" class="pob-dps is-bad">
            {{ tr("Ta compétence ne peut pas être utilisée avec cette arme", "Your skill can't be used with this weapon") }}
          </div>
          <div v-else class="pob-dps" :class="deltaClass(dpsChange(r))">
            <span class="pob-dps-pct">{{ pct(dpsChange(r)) }}</span>
            <span class="pob-dps-label">DPS · {{ pobResult.skill }}</span>
          </div>

          <!-- every damaging skill -->
          <div v-if="r.skills && r.skills.length" class="pob-section">
            <div class="pob-section-title">{{ tr("Compétences", "Skills") }}</div>
            <div v-for="s in sortedSkills(r)" :key="s.index" class="pob-skill-row">
              <span class="pob-skill-name truncate">
                <i v-if="s.main" class="fas fa-star"></i>{{ s.label }}
              </span>
              <span class="pob-skill-abs">{{ num(s.before) }} → {{ num(s.after) }}</span>
              <span class="pob-skill-pct" :class="deltaClass(skillChange(s))">
                {{ s.before > 0 && s.after === 0 ? tr("inutilisable", "unusable") : pct(skillChange(s)) }}
              </span>
            </div>
          </div>

          <div v-if="attributeProblem(r)" class="pob-warn">
            <i class="fas fa-exclamation-triangle"></i> {{ attributeProblem(r) }}
          </div>

          <!-- other changes, grouped -->
          <div v-for="g in groups(r)" :key="g.title" class="pob-section">
            <div class="pob-section-title">{{ g.title }}</div>
            <div class="pob-chips">
              <span v-for="c in g.rows" :key="c.key" class="pob-chip" :class="deltaClass(c.good)">
                <span class="pob-chip-label">{{ c.label }}</span>
                {{ c.text }}
              </span>
            </div>
          </div>
          <div v-if="!groups(r).length" class="pob-sub pob-nochange">
            {{ tr("Aucun autre changement (défense, attributs…).", "No other change (defence, attributes…).") }}
          </div>
        </div>
        <div v-if="pobResult.unknownMods" class="pob-note">
          {{ tr(`${pobResult.unknownMods} mod(s) non reconnu(s) : résultat approximatif`, `${pobResult.unknownMods} unknown mod(s): approximate result`) }}
        </div>
      </template>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { watch } from "vue";
import { tr, dateLocale } from "@/web/atziri-lang";
import { Host } from "@/web/background/IPC";
import {
  pobBusy,
  pobResult,
  dpsOf,
  type PobSkillDps,
  type PobSlotResult,
} from "./atziri-pob";

// the card goes away by itself after a while, with Escape, or once the mouse
// has moved away from the item (the game keeps the input: main tells us)
const SHOW_MS = 12_000;
let timer: ReturnType<typeof setTimeout> | undefined;
watch(pobResult, (r) => {
  clearTimeout(timer);
  if (r) timer = setTimeout(() => (pobResult.value = null), SHOW_MS);
});
Host.onEvent("MAIN->CLIENT::pob-dismiss", () => {
  pobResult.value = null;
});

const SLOT_LABELS: Record<string, [string, string]> = {
  "Weapon 1": ["Arme", "Weapon"],
  "Weapon 2": ["Arme secondaire", "Off hand"],
  "Weapon 1 Swap": ["Arme (set 2)", "Weapon (set 2)"],
  "Weapon 2 Swap": ["Arme secondaire (set 2)", "Off hand (set 2)"],
  "Helmet": ["Casque", "Helmet"],
  "Body Armour": ["Armure", "Body armour"],
  "Gloves": ["Gants", "Gloves"],
  "Boots": ["Bottes", "Boots"],
  "Amulet": ["Amulette", "Amulet"],
  "Ring 1": ["Anneau 1", "Ring 1"],
  "Ring 2": ["Anneau 2", "Ring 2"],
  "Belt": ["Ceinture", "Belt"],
};

function slotLabel(slot: string) {
  const l = SLOT_LABELS[slot];
  return l ? tr(l[0], l[1]) : slot;
}

/** "Doom Spike, Runeforged Winged Spear" -> "Doom Spike" */
function itemName(name?: string) {
  if (!name) return "";
  const [first, second] = name.split(", ");
  return first === "Overlay Item" ? second ?? first : first;
}

// --------------------------------------------------------------- formats

type Format = "int" | "dec1" | "dec2" | "pct" | "pct1" | "mult" | "speed";

function fmt(value: number, format: Format) {
  const loc = dateLocale();
  switch (format) {
    case "int":
      return Math.round(value).toLocaleString(loc);
    case "dec1":
      return value.toLocaleString(loc, { maximumFractionDigits: 1 });
    case "dec2":
      return value.toLocaleString(loc, { maximumFractionDigits: 2 });
    case "pct":
      return `${Math.round(value).toLocaleString(loc)} %`;
    case "pct1":
      return `${value.toLocaleString(loc, { maximumFractionDigits: 1 })} %`;
    case "mult":
      return `×${value.toLocaleString(loc, { maximumFractionDigits: 2 })}`;
    case "speed":
      // movement speed is a multiplier (1.37 = +37 %)
      return `${Math.round((value - 1) * 100).toLocaleString(loc)} %`;
  }
}

interface Row {
  key: string;
  fr: string;
  en: string;
  format: Format;
  /** a lower value is better (mana cost) */
  lowerIsBetter?: true;
}

const GROUPS: Array<{ fr: string; en: string; rows: Row[] }> = [
  {
    fr: "Offense (compétence principale)",
    en: "Offence (main skill)",
    rows: [
      { key: "AverageDamage", fr: "Dégâts par coup", en: "Damage per hit", format: "int" },
      { key: "Speed", fr: "Vitesse", en: "Speed", format: "dec2" },
      { key: "CritChance", fr: "Critique", en: "Crit chance", format: "pct1" },
      { key: "CritMultiplier", fr: "Dégâts critiques", en: "Crit damage", format: "mult" },
      { key: "HitChance", fr: "Chance de toucher", en: "Hit chance", format: "pct" },
      { key: "ManaCost", fr: "Coût en mana", en: "Mana cost", format: "int", lowerIsBetter: true },
    ],
  },
  {
    fr: "Défense",
    en: "Defence",
    rows: [
      { key: "Life", fr: "Vie", en: "Life", format: "int" },
      { key: "EnergyShield", fr: "Bouclier d'énergie", en: "Energy shield", format: "int" },
      { key: "TotalEHP", fr: "PV effectifs", en: "Effective HP", format: "int" },
      { key: "PhysicalMaximumHitTaken", fr: "Coup max physique", en: "Max physical hit", format: "int" },
      { key: "FireMaximumHitTaken", fr: "Coup max feu", en: "Max fire hit", format: "int" },
      { key: "ColdMaximumHitTaken", fr: "Coup max froid", en: "Max cold hit", format: "int" },
      { key: "LightningMaximumHitTaken", fr: "Coup max foudre", en: "Max lightning hit", format: "int" },
      { key: "ChaosMaximumHitTaken", fr: "Coup max chaos", en: "Max chaos hit", format: "int" },
      { key: "Armour", fr: "Armure", en: "Armour", format: "int" },
      { key: "PhysicalDamageReduction", fr: "Réduction physique", en: "Phys. reduction", format: "pct" },
      { key: "Evasion", fr: "Évasion", en: "Evasion", format: "int" },
      { key: "EvadeChance", fr: "Esquive", en: "Evade chance", format: "pct" },
      { key: "BlockChance", fr: "Blocage", en: "Block", format: "pct" },
      { key: "SpellBlockChance", fr: "Blocage des sorts", en: "Spell block", format: "pct" },
      { key: "LifeRegenRecovery", fr: "Régén. vie /s", en: "Life regen /s", format: "dec1" },
    ],
  },
  {
    fr: "Résistances",
    en: "Resistances",
    rows: [
      { key: "FireResist", fr: "Feu", en: "Fire", format: "pct" },
      { key: "ColdResist", fr: "Froid", en: "Cold", format: "pct" },
      { key: "LightningResist", fr: "Foudre", en: "Lightning", format: "pct" },
      { key: "ChaosResist", fr: "Chaos", en: "Chaos", format: "pct" },
    ],
  },
  {
    fr: "Ressources et attributs",
    en: "Resources and attributes",
    rows: [
      { key: "Mana", fr: "Mana", en: "Mana", format: "int" },
      { key: "ManaRegenRecovery", fr: "Régén. mana /s", en: "Mana regen /s", format: "dec1" },
      { key: "Spirit", fr: "Esprit", en: "Spirit", format: "int" },
      { key: "MovementSpeedMod", fr: "Vitesse de déplacement", en: "Movement speed", format: "speed" },
      { key: "Str", fr: "Force", en: "Strength", format: "int" },
      { key: "Dex", fr: "Dextérité", en: "Dexterity", format: "int" },
      { key: "Int", fr: "Intelligence", en: "Intelligence", format: "int" },
    ],
  },
];

/** Changed values only, as "before → after (+diff)" */
function groups(r: PobSlotResult) {
  const before = pobResult.value?.before ?? {};
  return GROUPS.flatMap((g) => {
    const rows = g.rows.flatMap((row) => {
      const b = before[row.key];
      const a = r.after[row.key];
      // changed = shows differently (catches 1.62 -> 1.66 attacks per second)
      if (b == null || a == null || fmt(a, row.format) === fmt(b, row.format)) return [];
      const better = row.lowerIsBetter ? b - a : a - b;
      return [{
        key: row.key,
        label: tr(row.fr, row.en),
        text: `${fmt(b, row.format)} → ${fmt(a, row.format)}`,
        good: better,
      }];
    });
    return rows.length ? [{ title: tr(g.fr, g.en), rows }] : [];
  });
}

/** Warns when the new item raises an attribute requirement above what the character has */
function attributeProblem(r: PobSlotResult) {
  const names: Array<[string, string, string, string]> = [
    ["Str", "ReqStr", "Force", "Strength"],
    ["Dex", "ReqDex", "Dextérité", "Dexterity"],
    ["Int", "ReqInt", "Intelligence", "Intelligence"],
  ];
  const missing = names.flatMap(([have, req, fr, en]) => {
    const h = r.after[have] ?? 0;
    const q = r.after[req] ?? 0;
    return q > h ? [`${tr(fr, en)} ${Math.round(h)}/${Math.round(q)}`] : [];
  });
  return missing.length
    ? tr("Attributs insuffisants : ", "Not enough attributes: ") + missing.join(", ")
    : "";
}

// -------------------------------------------------------------- DPS

function dpsChange(r: PobSlotResult) {
  const before = dpsOf(pobResult.value?.before);
  return before ? dpsOf(r.after) / before - 1 : 0;
}

function skillChange(s: PobSkillDps) {
  return s.before ? s.after / s.before - 1 : s.after > 0 ? 1 : 0;
}

/** main skill first, then the highest DPS */
function sortedSkills(r: PobSlotResult) {
  return [...(r.skills ?? [])].sort(
    (a, b) => Number(b.main) - Number(a.main) || b.before - a.before,
  );
}

function unusable(r: PobSlotResult) {
  return dpsOf(pobResult.value?.before) > 0 && dpsOf(r.after) === 0;
}

function deltaClass(diff: number) {
  if (Math.abs(diff) < 1e-4) return "is-same";
  return diff > 0 ? "is-good" : "is-bad";
}

function pct(change: number) {
  const v = change * 100;
  const s = v.toLocaleString(dateLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  return `${v > 0 ? "+" : ""}${s} %`;
}

function num(v: number) {
  return Math.round(v).toLocaleString(dateLocale());
}

function errorText(error?: string) {
  switch (error) {
    case "no-profile":
      return tr("Ajoute le lien poe.ninja de ton personnage dans Réglages Ritualiste.", "Add your character's poe.ninja link in Ritualist settings.");
    case "pob-not-found":
      return tr("Path of Building 2 n'est pas installé sur ce PC.", "Path of Building 2 is not installed on this PC.");
    case "unknown-base":
      return tr("Objet non reconnu.", "Unknown item.");
    case "bad-profile-url":
      return tr("Le lien poe.ninja n'est pas valide.", "The poe.ninja link is not valid.");
    case "timeout":
      return tr("Path of Building met trop de temps à répondre.", "Path of Building took too long to answer.");
    default:
      return tr("Comparaison impossible", "Comparison failed") + (error ? ` : ${error}` : "");
  }
}
</script>

<style lang="postcss">
.pob-card {
  position: absolute;
  top: 8%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: 32rem;
  max-height: 80vh;
  overflow-y: auto;
  padding: 14px 18px;
  border: 1px solid rgb(var(--c-gray-700));
  border-top: 3px solid rgb(var(--c-blue-400));
  border-radius: 10px;
  background: rgb(var(--c-gray-900) / 0.97);
  box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.6);
  color: rgb(var(--c-gray-200));
  font-family: "Inter", "Segoe UI", system-ui, sans-serif;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.pob-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 6px;
}

.pob-title {
  flex: none;
  font-weight: 600;
  color: rgb(var(--c-blue-400));
}

.pob-item {
  font-weight: 600;
  min-width: 0;
}

.pob-sub {
  color: rgb(var(--c-gray-400));
  font-size: 13px;

  b {
    color: rgb(var(--c-gray-200));
    font-weight: 500;
  }
}

.pob-slot + .pob-slot {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 2px solid rgb(var(--c-gray-700));
}

.pob-dps {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 6px 0 2px;
  font-weight: 600;
}

.pob-dps-pct {
  font-size: 28px;
  font-weight: 700;
}

.pob-dps-label {
  font-size: 14px;
  color: rgb(var(--c-gray-300));
}

.pob-section {
  margin-top: 10px;
}

.pob-section-title {
  margin-bottom: 4px;
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgb(var(--c-gray-400));
}

.pob-skill-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 5.5rem;
  gap: 10px;
  align-items: baseline;
  padding: 2px 0;

  .fa-star {
    margin-right: 6px;
    font-size: 11px;
    color: rgb(var(--c-blue-400));
  }
}

.pob-skill-abs {
  color: rgb(var(--c-gray-400));
  font-size: 13px;
}

.pob-skill-pct {
  text-align: right;
  font-weight: 600;
}

.pob-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
}

.pob-chip {
  padding: 2px 8px;
  border: 1px solid rgb(var(--c-gray-700));
  border-radius: 6px;
  font-size: 13px;
}

.pob-chip-label {
  color: rgb(var(--c-gray-400));
  margin-right: 4px;
}

.pob-nochange {
  margin-top: 8px;
}

.pob-card .is-good {
  color: #7fd38f;
}

.pob-card .is-bad {
  color: #ec6b6b;
}

.pob-card .is-same {
  color: rgb(var(--c-gray-300));
}

.pob-warn {
  margin-top: 8px;
  color: #e8a33a;
  font-size: 13px;
}

.pob-error {
  color: #e8a33a;
}

.pob-note {
  margin-top: 10px;
  color: #e8a33a;
  font-size: 12.5px;
}

.pob-card-enter-active,
.pob-card-leave-active {
  transition: opacity 0.15s ease;
}

.pob-card-enter-from,
.pob-card-leave-to {
  opacity: 0;
}
</style>
