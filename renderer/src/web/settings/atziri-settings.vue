<template>
  <!-- Atziri Exchange: the most used settings, gathered on the first page -->
  <div class="flex gap-6 p-2 items-start justify-between">
  <div class="max-w-md flex-1">
    <!-- League -->
    <div class="mb-2" v-if="!leagues.error.value">
      <div class="flex-1 mb-1">
        {{ t("league") }}
        <button
          class="btn"
          @click="leagues.load"
          :disabled="leagues.isLoading.value"
        >
          {{ tr("Actualiser", "Refresh") }}
        </button>
      </div>
      <div v-if="leagues.isLoading.value" class="mb-4">
        <i class="fas fa-info-circle text-gray-600"></i>
        {{ t("app.leagues_loading") }}
      </div>
      <template v-else-if="leagues.list.value.length">
        <div class="mb-2 flex flex-col gap-1 items-start whitespace-nowrap">
          <ui-radio
            v-for="league of leagues.list.value"
            :key="league.id"
            v-model="leagueId"
            :value="league.id"
            >{{ league.text }}</ui-radio
          >
        </div>
        <div class="flex gap-x-2 mb-4">
          <div class="text-gray-500">{{ t("settings.private_league") }}</div>
          <input
            v-model="customLeagueId"
            placeholder="My League (PL12345)"
            class="rounded bg-gray-900 px-1 mb-1 flex-1"
          />
        </div>
      </template>
    </div>
    <ui-error-box v-else class="mb-4">
      <template #name>{{ t("app.leagues_failed") }}</template>
      <p>{{ t("app.leagues_failed_help_alt") }}</p>
      <template #actions>
        <button class="btn" @click="leagues.load">
          {{ tr("Réessayer", "Retry") }}
        </button>
      </template>
    </ui-error-box>

    <!-- Language -->
    <div class="mb-4">
      <div class="flex-1 mb-1">{{ t("settings.language") }}</div>
      <select v-model="language" class="p-1 rounded bg-gray-700 w-40">
        <option value="en">English</option>
        <option value="ru">Русский</option>
        <option value="cmn-Hant">正體中文</option>
        <option value="ko">한국어</option>
        <option value="ja">日本語</option>
        <option value="de">Deutsch</option>
        <option value="es">Español</option>
        <option value="pt">Português (Brasil)</option>
        <option value="fr">Français</option>
      </select>
    </div>

    <!-- Start with the game (Windows) -->
    <div v-if="autostart?.supported" class="mb-4">
      <ui-checkbox
        :model-value="autostart.enabled"
        @update:model-value="setAutostart"
        >{{ tr("Lancer avec le jeu", "Start with the game") }}</ui-checkbox
      >
      <div class="text-gray-500 text-sm mt-1">
        {{
          tr(
            "L'overlay démarre discrètement avec Windows (icône près de l'horloge) et s'active quand Path of Exile 2 s'ouvre. Désactivé : il se ferme 5 s après le jeu.",
            "The overlay starts quietly with Windows (icon near the clock) and wakes up when Path of Exile 2 opens. Off: it closes 5 s after the game.",
          )
        }}
      </div>
    </div>

    <!-- Fill stat values -->
    <div class="mb-2">
      <div class="flex-1 mb-1">{{ t("price_check.fill_rolls") }}</div>
      <div class="mb-4 flex">
        <div class="flex mr-6">
          <span class="mr-1">+-</span>
          <input
            v-model.number="searchStatRange"
            class="rounded bg-gray-900 px-1 block w-16 mb-1 font-poe text-center"
          />
          <span class="ml-1">%</span>
        </div>
        <ui-radio v-model="searchStatRange" :value="0">{{
          t("price_check.fill_roll_exact")
        }}</ui-radio>
      </div>
    </div>

    <!-- Core currency -->
    <div class="mb-4">
      <div class="flex-1 mb-1">{{ t("price_check.core_currency") }}</div>
      <div class="mb-1 flex">
        <ui-radio
          v-for="currency of availableCoreCurrencies"
          :key="currency.id"
          v-model="coreCurrency"
          :value="currency.id"
          class="mr-4"
          use-bg-selection
        >
          <div class="flex flex-row items-center">
            <ui-item-img
              :icon="currency.icon"
              overflow-hidden
              class="w-8 h-8"
            />
            <div>{{ t(currency.text) }}</div>
          </div>
        </ui-radio>
      </div>
    </div>
    <ui-checkbox class="mb-6" v-model="rememberCurrency">{{
      t("price_check.remember_currency")
    }}</ui-checkbox>

    <!-- Hotkeys -->
    <div class="flex flex-col gap-4 mb-6">
      <div class="flex">
        <label class="flex-1">{{ t("item.open_on_poedb") }}</label>
        <hotkey-input v-model="poedbKey" class="w-48" />
      </div>
      <HotkeysGeneric :hotkeys="priceCheckHotkeys" />
    </div>

    <!-- Item tooltip on price hover -->
    <div class="mb-4">
      <div class="flex-1 mb-1">{{ t("price_check.use_tooltip_hover") }}</div>
      <div class="mb-1 flex">
        <ui-radio v-model="tooltipHover" value="off" class="mr-4">{{
          t("price_check.use_tooltip_off")
        }}</ui-radio>
        <ui-radio v-model="tooltipHover" value="keybind" class="mr-4">{{
          t("price_check.use_tooltip_keybind")
        }}</ui-radio>
        <ui-radio v-model="tooltipHover" value="always">{{
          t("price_check.use_tooltip_always")
        }}</ui-radio>
      </div>
    </div>

    <!-- Item and mod lists kept up to date from GitHub -->
    <div class="atz-data mb-4">
      <div class="flex-1 mb-1">{{ tr("Listes d'objets et de mods", "Item and mod lists") }}</div>
      <ui-checkbox class="mb-2" :model-value="dataStatus?.enabled ?? true" @update:model-value="setDataEnabled">
        {{ tr("Mettre à jour automatiquement (vérifié toutes les 3 h)", "Update automatically (checked every 3 h)") }}
      </ui-checkbox>
      <div class="text-gray-400 mb-2">
        <template v-if="!dataStatus">{{ tr("Chargement…", "Loading…") }}</template>
        <template v-else-if="currentLangData">
          {{ tr("Mise à jour installée le", "Update installed on") }} {{ dayTime(currentLangData.updatedAt) }} ({{
            currentLangData.items
          }} {{ tr("objets", "items") }}, {{ currentLangData.stats }} mods){{
            currentLangData.active ? "" : tr(" — utilisée au prochain démarrage", " — used from the next start")
          }}.
        </template>
        <template v-else>{{ tr("Listes intégrées à l'appli (aucune mise à jour nécessaire pour l'instant).", "Lists bundled with the app (no update needed for now).") }}</template>
        <div v-if="dataStatus?.lastCheck">
          {{ tr("Dernière vérification :", "Last check:") }} {{ dayTime(dataStatus.lastCheck) }}
        </div>
        <div v-if="dataStatus?.lastError" class="text-red-400">
          {{ tr("Échec :", "Failed:") }} {{ dataStatus.lastError }}
        </div>
      </div>
      <div v-if="dataStatus?.upstream" class="atz-upstream mb-2">
        <template v-if="isFrench()">
          Nouvelle version d'Exiled Exchange 2 disponible ({{ dataStatus.upstream.version }}, tu as {{ dataStatus.appVersion }}).
          Les listes et les prix suivent tout seuls ; seules les nouveautés du code (nouveaux types d'objets) demandent une mise à jour de l'appli :
          demande à Claude de l'intégrer.
        </template>
        <template v-else>
          A new Exiled Exchange 2 version is out ({{ dataStatus.upstream.version }}, you have {{ dataStatus.appVersion }}).
          Lists and prices follow on their own; only code changes (new item types) need an app update:
          ask Claude to merge it.
        </template>
      </div>
      <div class="flex gap-2">
        <button
          v-if="dataStatus?.pendingApply"
          class="btn"
          :disabled="dataBusy"
          @click="applyNow"
        >
          {{ tr("Appliquer maintenant (redémarre)", "Apply now (restarts)") }}
        </button>
        <button class="btn" :disabled="dataBusy" @click="dataAction('check')">
          {{ dataBusy ? tr("Vérification…", "Checking…") : tr("Vérifier maintenant", "Check now") }}
        </button>
        <button class="btn" :disabled="dataBusy" @click="dataAction('reset')">
          {{ tr("Revenir aux listes d'origine", "Back to the original lists") }}
        </button>
      </div>
    </div>
  </div>

  <!-- Overlay colors: applied immediately, remembered on this PC -->
  <div class="atz-palette">
    <div class="atz-palette-title">{{ tr("Couleurs de l'overlay", "Overlay colors") }}</div>
    <div class="atz-palette-sub">{{ tr("Thèmes d'Atziri Regex", "Atziri Regex themes") }}</div>
    <div class="flex flex-wrap gap-2 mb-4">
      <button
        v-for="(preset, id) in THEME_PRESETS"
        :key="id"
        type="button"
        class="atz-preset"
        :class="{ 'is-active': isPreset(preset.colors) }"
        @click="setTheme(preset.colors)"
      >
        <span
          class="atz-dot"
          :style="{ background: preset.colors.accent, borderColor: preset.colors.line }"
        ></span>
        {{ tr(preset.label, THEME_NAMES_EN[id] ?? preset.label) }}
      </button>
    </div>
    <div class="atz-palette-sub">{{ tr("Personnaliser", "Customize") }}</div>
    <div
      v-for="field in COLOR_FIELDS"
      :key="field.key"
      class="atz-color"
      :class="{ 'is-selected': selectedField === field.key }"
      @click="selectedField = field.key"
    >
      <input
        type="color"
        :title="tr('Couleur libre', 'Any color')"
        :value="themeColors[field.key]"
        @click.stop="selectedField = field.key"
        @input="setColor(field.key, ($event.target as HTMLInputElement).value)"
      />
      <span class="flex-1">{{ tr(field.label, field.labelEn) }}</span>
      <code class="atz-hex">{{ themeColors[field.key] }}</code>
    </div>

    <!-- Ready-made colors for the selected field -->
    <div class="atz-palette-sub mt-3">
      Palette · {{ selectedLabel }}
    </div>
    <div class="atz-swatches">
      <button
        v-for="color in swatches"
        :key="color"
        type="button"
        class="atz-swatch"
        :class="{
          'is-active':
            themeColors[selectedField].toLowerCase() === color.toLowerCase(),
        }"
        :style="{ background: color }"
        :title="color"
        @click="setColor(selectedField, color)"
      ></button>
    </div>
    <button type="button" class="btn mt-3" @click="setTheme(DEFAULT_THEME)">
      {{ tr("Réinitialiser (Braise)", "Reset (Ember)") }}
    </button>

    <!-- Background images -->
    <div class="atz-palette-title mt-5">{{ tr("Images de fond", "Background images") }}</div>
    <div v-for="slot in BG_SLOTS" :key="slot.id" class="mb-3">
      <div class="atz-palette-sub">{{ tr(slot.label, slot.labelEn) }}</div>
      <div class="atz-bgs">
        <button
          v-for="bg in BUILTIN_BACKGROUNDS"
          :key="bg.id"
          type="button"
          class="atz-bg"
          :class="{ 'is-active': backgrounds[slot.id] === bg.id }"
          :style="{ backgroundImage: `url(${bg.url})` }"
          :title="tr(bg.label, BG_NAMES_EN[bg.id] ?? bg.label)"
          @click="setBackground(slot.id, bg.id)"
        >
          <span>{{ tr(bg.label, BG_NAMES_EN[bg.id] ?? bg.label) }}</span>
        </button>
        <button
          v-if="backgrounds[slot.id].startsWith('upload:')"
          type="button"
          class="atz-bg is-active"
          :style="{
            backgroundImage: `url(${backgroundUrl(backgrounds[slot.id])})`,
          }"
          :title="tr('Ton image', 'Your image')"
        >
          <span>{{ tr("Ton image", "Your image") }}</span>
        </button>
        <button
          type="button"
          class="atz-bg atz-bg-plain"
          :class="{ 'is-active': backgrounds[slot.id] === 'none' }"
          @click="setBackground(slot.id, 'none')"
        >
          <span>{{ tr("Aucune", "None") }}</span>
        </button>
        <label class="atz-bg atz-bg-plain" :title="tr('Choisir une image sur le PC', 'Pick an image on this PC')">
          <span><i class="fas fa-upload"></i> {{ tr("Importer…", "Import…") }}</span>
          <input
            type="file"
            accept="image/*"
            class="hidden"
            @change="importBackground(slot.id, $event)"
          />
        </label>
      </div>
    </div>
  </div>
  </div>
</template>

<script lang="ts">
export default {
  name: "Atziri réglage",
};
</script>

<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import UiRadio from "@/web/ui/UiRadio.vue";
import UiCheckbox from "@/web/ui/UiCheckbox.vue";
import UiErrorBox from "@/web/ui/UiErrorBox.vue";
import UiItemImg from "@/web/ui/UiItemImg.vue";
import HotkeyInput from "./HotkeyInput.vue";
import HotkeysGeneric, { HotkeySchema } from "./HotkeysGeneric.vue";
import {
  configProp,
  configModelValue,
  _configModelValue,
  findWidget,
} from "./utils";
import { AppConfig } from "@/web/Config";
import type { PriceCheckWidget } from "@/web/overlay/interfaces";
import type { ItemCheckWidget } from "../item-check/widget";
import { useLeagues } from "../background/Leagues";
import { usePoeninja } from "../background/Prices";
import {
  THEME_PRESETS,
  DEFAULT_THEME,
  themeColors,
  setTheme,
  type ThemeColors,
} from "../atziri-theme";
import {
  BUILTIN_BACKGROUNDS,
  backgrounds,
  backgroundUrl,
  setBackground,
  type BgSlot,
} from "../atziri-backgrounds";
import { Host } from "@/web/background/IPC";
import { tr, isFrench, dateLocale } from "@/web/atziri-lang";

const props = defineProps(configProp());

const COLOR_FIELDS: Array<{ key: keyof ThemeColors; label: string; labelEn: string }> = [
  { key: "accent", label: "Accent (doré)", labelEn: "Accent (gold)" },
  { key: "bg", label: "Fond", labelEn: "Background" },
  { key: "surface", label: "Panneaux", labelEn: "Panels" },
  { key: "line", label: "Bordures", labelEn: "Borders" },
  { key: "fg", label: "Texte", labelEn: "Text" },
  { key: "muted", label: "Texte secondaire", labelEn: "Secondary text" },
];
const THEME_NAMES_EN: Record<string, string> = {
  braise: "Ember",
  vaal: "Vaal",
  sang: "Blood",
  delire: "Delirium",
};
const BG_NAMES_EN: Record<string, string> = {
  temple: "Atziri's Temple",
  reine: "Queen Atziri",
};

// --- Item and mod lists updates (main process routes /atziri-data/*) ---
interface DataStatus {
  appVersion?: string;
  upstream?: { version: string; url: string } | null;
  pendingApply?: boolean;
  enabled: boolean;
  checking: boolean;
  lastError: string | null;
  lastCheck: number;
  langs: Record<string, { updatedAt: number; items: number; stats: number; active: boolean }>;
}
const dataStatus = shallowRef<DataStatus | null>(null);
const dataBusy = shallowRef(false);

async function loadDataStatus() {
  try {
    dataStatus.value = await (await fetch("/atziri-data/status")).json();
  } catch {
    // dev mode: no main-process routes
  }
}
loadDataStatus();

const currentLangData = computed(
  () => dataStatus.value?.langs[props.config.language],
);

async function dataAction(action: "check" | "reset") {
  dataBusy.value = true;
  try {
    dataStatus.value = await (
      await fetch(`/atziri-data/${action}`, { method: "POST" })
    ).json();
  } catch {
    // ignore
  } finally {
    dataBusy.value = false;
  }
}

// --- Start with the game (main process route /atziri-autostart) ---
const autostart = shallowRef<{ supported: boolean; enabled: boolean } | null>(
  null,
);
async function loadAutostart(on?: boolean) {
  try {
    const res = await fetch(
      on == null ? "/atziri-autostart" : `/atziri-autostart?on=${on ? 1 : 0}`,
      { method: on == null ? "GET" : "POST" },
    );
    autostart.value = await res.json();
  } catch {
    // dev mode: no main-process routes
  }
}
loadAutostart();
function setAutostart(on: boolean) {
  loadAutostart(on);
}

async function applyNow() {
  dataBusy.value = true;
  try {
    await fetch("/atziri-data/apply", { method: "POST" });
  } catch {
    dataBusy.value = false;
  }
}

async function setDataEnabled(on: boolean) {
  try {
    dataStatus.value = await (
      await fetch(`/atziri-data/enable?on=${on ? 1 : 0}`, { method: "POST" })
    ).json();
  } catch {
    // ignore
  }
}

function dayTime(t: number) {
  return new Date(t).toLocaleString(dateLocale(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Background images
const BG_SLOTS: Array<{ id: BgSlot; label: string; labelEn: string }> = [
  { id: "hub", label: "Shift + Espace", labelEn: "Shift + Space" },
  { id: "price", label: "Vérification du prix", labelEn: "Price check" },
];

async function importBackground(slot: BgSlot, e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const name = await Host.importFile(file);
    setBackground(slot, `upload:${name}`);
  } finally {
    input.value = "";
  }
}

// Palette: click a color row, then a swatch
const selectedField = shallowRef<keyof ThemeColors>("accent");
const selectedLabel = computed(
  () => {
    const f = COLOR_FIELDS.find((f) => f.key === selectedField.value);
    return f ? tr(f.label, f.labelEn) : "";
  },
);
// light/vivid colors for accent and text, dark ones for backgrounds/borders
const BRIGHT_SWATCHES = [
  "#d8a24f", "#e8c46a", "#f0d48a", "#c97a3a", "#e07b4f", "#d24b40",
  "#e2654f", "#ff8a5c", "#e7707a", "#d9584a", "#b8475e", "#c06cc4",
  "#c3b8e8", "#8f86e0", "#6aa8e8", "#4fb3d8", "#56c9a6", "#6cc086",
  "#9cc46f", "#c8d36a", "#ebdfc6", "#dde9e3", "#f1e3df", "#e6e4ee",
  "#ffffff", "#d0c8b8", "#a8977b", "#8ea79f", "#b49a96", "#9a97ab",
];
const DARK_SWATCHES = [
  "#0e0c0a", "#0a1110", "#110909", "#0f0f13", "#000000", "#121212",
  "#1f1914", "#121c1b", "#1c1012", "#18181f", "#1a1a1a", "#14181f",
  "#2a2119", "#16241f", "#2a1418", "#22222c", "#262626", "#1b2230",
  "#3b3025", "#264039", "#45232a", "#34333f", "#3a3a3a", "#2c3a52",
  "#5a4632", "#2f5a4c", "#5e2a33", "#4a4860", "#555555", "#3d4f6e",
];
const swatches = computed(() =>
  ["bg", "surface", "line"].includes(selectedField.value)
    ? DARK_SWATCHES
    : BRIGHT_SWATCHES,
);

function setColor(key: keyof ThemeColors, value: string) {
  setTheme({ ...themeColors.value, [key]: value });
}

function isPreset(colors: ThemeColors) {
  return (Object.keys(colors) as Array<keyof ThemeColors>).every(
    (k) => colors[k].toLowerCase() === themeColors.value[k].toLowerCase(),
  );
}
const { t } = useI18n();

const leagues = useLeagues();
const { availableCoreCurrencies } = usePoeninja();

const priceCheck = computed(
  () => findWidget<PriceCheckWidget>("price-check", props.config)!,
);
const itemCheck = computed(
  () => findWidget<ItemCheckWidget>("item-check", props.config)!,
);

const leagueId = configModelValue(() => props.config, "leagueId");
const customLeagueId = computed<string>({
  get: () =>
    !leagues.list.value.some((league) => league.id === props.config.leagueId)
      ? (props.config.leagueId ?? "")
      : "",
  set: (value) => {
    props.config.leagueId = value;
  },
});

const language = computed<typeof props.config.language>({
  get() {
    return props.config.language;
  },
  set(value) {
    props.config.language = value;
    AppConfig().language = value;
    if (value !== "cmn-Hant") {
      props.config.realm = "pc-ggg";
    }
  },
});

const searchStatRange = computed<number>({
  get() {
    return priceCheck.value.searchStatRange;
  },
  set(value) {
    if (typeof value !== "number") return;
    if (value >= 0 && value <= 50) {
      priceCheck.value.searchStatRange = value;
    }
  },
});

const coreCurrency = configModelValue(() => priceCheck.value, "coreCurrency");
const rememberCurrency = configModelValue(
  () => priceCheck.value,
  "rememberCurrency",
);
const tooltipHover = configModelValue(
  () => priceCheck.value,
  "itemHoverTooltip",
);
const poedbKey = configModelValue(() => itemCheck.value, "poedbKey");

const priceCheckHotkeys = computed<HotkeySchema[]>(() => [
  {
    translationKey: "price_check.name",
    items: [
      {
        translationKey: "price_check.hotkey",
        config: {
          modKey: _configModelValue(priceCheck.value, "hotkeyHold"),
          nonModKey: _configModelValue(priceCheck.value, "hotkey"),
        },
      },
      {
        translationKey: "price_check.hotkey_locked",
        config: _configModelValue(priceCheck.value, "hotkeyLocked"),
      },
    ],
  },
]);
</script>

<style lang="postcss">
.atz-bgs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.atz-bg {
  position: relative;
  height: 52px;
  border-radius: 6px;
  border: 1px solid theme("colors.gray.700");
  background-size: cover;
  background-position: center;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  align-items: flex-end;

  span {
    width: 100%;
    font-size: 11px;
    padding: 2px 6px;
    background: rgb(var(--c-gray-900) / 0.75);
    text-align: left;
  }

  &:hover {
    border-color: theme("colors.blue.400");
  }

  &.is-active {
    border-color: theme("colors.blue.400");
    box-shadow: 0 0 0 1px theme("colors.blue.400");
  }
}

.atz-bg-plain {
  align-items: center;
  background: theme("colors.gray.800");

  span {
    background: transparent;
    text-align: center;
  }
}

.atz-upstream {
  padding: 6px 8px;
  border: 1px solid theme("colors.blue.400");
  border-radius: 6px;
  color: theme("colors.gray.200");
  background: rgb(var(--c-blue-900) / 0.6);
}

.atz-palette {
  width: 17rem;
  flex: none;
  margin-left: auto;
  padding: 12px 14px;
  border: 1px solid theme("colors.gray.700");
  border-radius: 8px;
  background: rgb(var(--c-gray-900) / 0.6);
}

.atz-palette-title {
  font-family: "Cinzel", "Marcellus", Georgia, serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: theme("colors.blue.400");
  margin-bottom: 10px;
}

.atz-palette-sub {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: theme("colors.gray.400");
  margin-bottom: 6px;
}

.atz-preset {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid theme("colors.gray.700");
  background: theme("colors.gray.800");
  font-size: 12.5px;

  &:hover {
    border-color: theme("colors.blue.400");
  }

  &.is-active {
    border-color: theme("colors.blue.400");
    color: theme("colors.blue.400");
  }
}

.atz-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid;
  display: inline-block;
}

.atz-swatches {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 4px;
}

.atz-swatch {
  aspect-ratio: 1;
  border-radius: 5px;
  border: 1px solid rgb(255 255 255 / 0.12);
  cursor: pointer;

  &:hover {
    transform: scale(1.12);
  }

  &.is-active {
    outline: 2px solid theme("colors.blue.400");
    outline-offset: 1px;
  }
}

.atz-color {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px;
  margin: 0 -6px;
  border-radius: 5px;
  border: 1px solid transparent;
  cursor: pointer;

  &.is-selected {
    border-color: theme("colors.blue.400");
    background: theme("colors.blue.900");
  }

  input[type="color"] {
    width: 34px;
    height: 24px;
    padding: 0;
    border: 1px solid theme("colors.gray.700");
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
  }
}

.atz-hex {
  font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace;
  font-size: 12px;
  color: theme("colors.gray.400");
}
</style>