<template>
  <!-- My Ritualist Overlay: the character's stats, from its Path of Building build -->
  <div class="ar-body">
    <fieldset class="ar-nav ar-session">
      <legend>Stats</legend>

      <template v-if="status?.build">
        <div class="ar-st-who">{{ who }}</div>
        <div class="ar-sub">{{ leagueName || "Path of Exile 2" }}</div>
        <div class="ar-sub">
          {{ buildLine }}
        </div>

        <label class="ar-st-skill">
          <span class="ar-sub">{{ tr("Compétence principale", "Main skill") }}</span>
          <select
            :value="status.build.mainSkill"
            :disabled="busy"
            @change="setSkill(Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="s in status.build.skills" :key="s.index" :value="s.index">{{ s.label }}</option>
          </select>
        </label>
      </template>

      <div v-else-if="busy" class="ar-sub">
        <i class="fas fa-spinner fa-spin"></i> {{ tr("Chargement du build…", "Loading the build…") }}
      </div>
      <div v-else class="ar-sub ar-dr-warn">
        <i class="fas fa-exclamation-triangle"></i> {{ emptyText }}
      </div>

      <button type="button" @click="load">
        <i class="fas fa-sync-alt"></i> {{ tr("Recharger", "Reload") }}
      </button>
      <button type="button" @click="emit('settings')">
        <i class="fas fa-cog"></i> {{ tr("Choisir le build", "Choose the build") }}
      </button>
    </fieldset>

    <section class="ar-main ar-st-main">
      <div class="ar-main-head">
        <h2>{{ status?.build ? who : "Stats" }}</h2>
        <div class="ar-sub">
          {{
            status?.build
              ? `${status.build.mainSkillLabel ?? ""} · ${num(dps)} DPS`
              : tr("Les stats de ton personnage, calculées par Path of Building.", "Your character's stats, computed by Path of Building.")
          }}
        </div>
      </div>

      <div v-if="status?.build" class="ar-st-groups">
        <section v-for="g in groups" :key="g.title" class="ar-st-group">
          <h3>{{ g.title }}</h3>
          <dl>
            <template v-for="r in g.rows" :key="r.label">
              <dt>{{ r.label }}</dt>
              <dd :class="r.tone">{{ r.value }}</dd>
            </template>
          </dl>
        </section>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue";
import { tr, dateLocale, isFrench } from "@/web/atziri-lang";
import { useLeagues } from "@/web/background/Leagues";
import { buildAge, type PobBuildInfo } from "./atziri-pob";

const emit = defineEmits<{ (e: "settings"): void }>();

interface Status {
  pobFound: boolean;
  source: "pob" | "ninja";
  buildInfo: PobBuildInfo;
  build: {
    className?: string;
    level?: number;
    skills: Array<{ index: number; label: string }>;
    mainSkill: number;
    mainSkillLabel?: string;
    stats: Record<string, number>;
  } | null;
  error: string | null;
}

const status = shallowRef<Status | null>(null);
const busy = shallowRef(false);
const leagues = useLeagues();
const leagueName = computed(() => leagues.selectedId.value ?? "");

async function call(path: string, body?: unknown) {
  busy.value = true;
  try {
    const res = await fetch(`/atziri-pob/${path}`, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    status.value = (await res.json()) as Status;
  } catch {
    // dev mode: no main-process routes
  } finally {
    busy.value = false;
  }
}

function load() {
  call("load");
}
function setSkill(index: number) {
  call("skill", { index });
}
onMounted(load);

const who = computed(() => {
  const b = status.value?.build;
  if (!b) return "";
  return [b.className, b.level ? tr(`niveau ${b.level}`, `level ${b.level}`) : ""]
    .filter(Boolean)
    .join(" · ");
});

const buildLine = computed(() => {
  const info = status.value?.buildInfo;
  if (!info?.at) return "";
  const age = buildAge(info.at, isFrench());
  return info.source === "pob"
    ? tr(`Build « ${info.name ?? ""} » enregistré ${age}`, `Build "${info.name ?? ""}" saved ${age}`)
    : tr(`Build relevé sur poe.ninja ${age}`, `Build read on poe.ninja ${age}`);
});

const emptyText = computed(() => {
  const s = status.value;
  if (s && !s.pobFound) return tr("Path of Building 2 n'est pas installé sur ce PC.", "Path of Building 2 is not installed on this PC.");
  if (s?.error === "no-pob-build") {
    return tr("Aucun build enregistré dans Path of Building : importe ton personnage puis Ctrl + S.", "No build saved in Path of Building: import your character, then Ctrl + S.");
  }
  return s?.error ?? tr("Aucun build chargé.", "No build loaded.");
});

function num(v: number | undefined, digits = 0) {
  return (v ?? 0).toLocaleString(dateLocale(), {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

const dps = computed(() => {
  const s = status.value?.build?.stats;
  return s ? s.CombinedDPS || s.TotalDPS || 0 : 0;
});

interface Row {
  label: string;
  value: string;
  tone?: string;
}

const groups = computed(() => {
  const s = status.value?.build?.stats ?? {};
  const has = (k: string) => typeof s[k] === "number";
  const row = (fr: string, en: string, value: string, tone?: string): Row => ({
    label: tr(fr, en),
    value,
    tone,
  });
  const pct = (k: string, digits = 0) => `${num(s[k], digits)} %`;
  // resistances: capped at 75 %, under 0 is dangerous
  const res = (k: string) => (s[k] >= 75 ? "is-good" : s[k] < 0 ? "is-bad" : undefined);

  const offence: Row[] = [row("DPS", "DPS", num(dps.value))];
  if (has("AverageDamage")) offence.push(row("Dégâts par coup", "Damage per hit", num(s.AverageDamage)));
  if (has("Speed")) offence.push(row("Utilisations par seconde", "Uses per second", num(s.Speed, 2)));
  if (has("CritChance")) offence.push(row("Chance de critique", "Critical chance", pct("CritChance", 1)));
  if (has("CritMultiplier")) offence.push(row("Multiplicateur critique", "Critical multiplier", `×${num(s.CritMultiplier, 2)}`));
  if (has("HitChance")) offence.push(row("Chance de toucher", "Hit chance", pct("HitChance")));
  if (has("ManaCost")) offence.push(row("Coût en mana", "Mana cost", num(s.ManaCost)));

  const defence: Row[] = [];
  if (has("Life")) defence.push(row("Vie", "Life", num(s.Life)));
  if (has("EnergyShield") && s.EnergyShield > 0) defence.push(row("Bouclier d'énergie", "Energy shield", num(s.EnergyShield)));
  if (has("Armour")) defence.push(row("Armure", "Armour", num(s.Armour)));
  if (has("Evasion")) defence.push(row("Évasion", "Evasion", num(s.Evasion)));
  if (has("TotalEHP")) defence.push(row("PV effectifs", "Effective HP", num(s.TotalEHP)));
  if (has("BlockChance")) defence.push(row("Blocage", "Block", pct("BlockChance")));
  if (has("MovementSpeedMod")) defence.push(row("Vitesse de déplacement", "Movement speed", `${num((s.MovementSpeedMod - 1) * 100)} %`));

  const resist: Row[] = [
    ["FireResist", "Feu", "Fire"],
    ["ColdResist", "Froid", "Cold"],
    ["LightningResist", "Foudre", "Lightning"],
    ["ChaosResist", "Chaos", "Chaos"],
  ]
    .filter(([k]) => has(k))
    .map(([k, fr, en]) => row(fr, en, pct(k), res(k)));

  const resources: Row[] = [];
  if (has("Mana")) resources.push(row("Mana", "Mana", num(s.Mana)));
  if (has("Spirit")) resources.push(row("Esprit", "Spirit", num(s.Spirit)));
  if (has("Str")) resources.push(row("Force", "Strength", num(s.Str)));
  if (has("Dex")) resources.push(row("Dextérité", "Dexterity", num(s.Dex)));
  if (has("Int")) resources.push(row("Intelligence", "Intelligence", num(s.Int)));

  return [
    { title: tr("Offense", "Offence"), rows: offence },
    { title: tr("Défense", "Defence"), rows: defence },
    { title: tr("Résistances", "Resistances"), rows: resist },
    { title: tr("Ressources et attributs", "Resources and attributes"), rows: resources },
  ].filter((g) => g.rows.length);
});
</script>

<style lang="postcss">
.ar-st-who {
  font-size: 1.15rem;
  font-weight: 600;
}

.ar-st-skill {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 12px 0 6px;
}

.ar-st-skill select {
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--fg);
  padding: 6px 8px;
}

.ar-st-main {
  overflow-y: auto;
}

.ar-st-groups {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
  gap: 28px 40px;
  align-content: start;
}

.ar-st-group h3 {
  margin: 0 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.ar-st-group dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 7px 16px;
  margin: 0;
}

.ar-st-group dt {
  color: var(--muted);
}

.ar-st-group dd {
  margin: 0;
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.ar-st-group dd.is-good {
  color: var(--ok);
}

.ar-st-group dd.is-bad {
  color: var(--bad);
}
</style>
