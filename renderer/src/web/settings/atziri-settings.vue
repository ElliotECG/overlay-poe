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

    <!-- Show on Discord (main process route /atziri-discord) -->
    <div v-if="discord" class="mb-4">
      <ui-checkbox :model-value="discord.enabled" @update:model-value="setDiscord">
        {{ tr("Afficher sur Discord que j'utilise My Ritualist Overlay", "Show on Discord that I use My Ritualist Overlay") }}
      </ui-checkbox>
      <div class="text-gray-500 text-sm mt-1">
        {{
          tr(
            "Ton profil Discord affiche « Joue à My Ritualist Overlay », ton personnage et un lien vers l'overlay. Passe par l'application Discord de ce PC, aucun compte à connecter.",
            "Your Discord profile shows \"Playing My Ritualist Overlay\", your character and a link to the overlay. Goes through the Discord app of this PC, no account to connect.",
          )
        }}
        <template v-if="discord.enabled">
          ·
          {{
            discord.connected
              ? tr("Discord connecté.", "Discord connected.")
              : tr("Discord pas encore détecté (il doit être ouvert).", "Discord not detected yet (it must be open).")
          }}
        </template>
      </div>
    </div>

    <!-- Hide the overlay from captures (main process route /atziri-capture) -->
    <div v-if="capture" class="mb-4">
      <ui-checkbox :model-value="capture.hidden" @update:model-value="setCapture">
        {{ tr("Masquer l'overlay des captures (stream, Death Recap)", "Hide the overlay from captures (stream, Death Recap)") }}
      </ui-checkbox>
      <div class="text-gray-500 text-sm mt-1">
        {{
          capture.hidden
            ? tr(
                "Activé : les vidéos Death Recap ne montrent que le jeu, mais l'overlay est aussi invisible en stream (OBS, partage d'écran Discord) et sur les captures d'écran. Décoche pour que tes viewers le voient.",
                "On: Death Recap videos show only the game, but the overlay is also invisible in streams (OBS, Discord screen sharing) and screenshots. Uncheck it so your viewers see it.",
              )
            : tr(
                "Désactivé : tes viewers voient l'overlay. Il apparaît aussi dans une vidéo Death Recap s'il est ouvert au moment de la mort. Dans OBS, utilise « Capture d'écran » (la « Capture de jeu » ne montre que le jeu).",
                "Off: your viewers see the overlay. It also shows in a Death Recap video when it is open at the moment of death. In OBS, use \"Display Capture\" (\"Game Capture\" shows only the game).",
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

    <!-- Compare in Path of Building (main process routes /atziri-pob/*) -->
    <div class="atz-data mb-6">
      <div class="mb-1">{{ tr("Comparer avec Path of Building", "Compare in Path of Building") }}</div>
      <div class="text-gray-400 mb-3">
        {{
          tr(
            "Survole un objet (chez un marchand, dans un coffre…) et appuie sur le raccourci : l'overlay calcule avec ton build l'effet sur ton DPS, ta vie, tes défenses et tes résistances.",
            "Hover an item (in a merchant tab, a stash…) and press the shortcut: the overlay uses your build to show the effect on your DPS, life, defences and resistances.",
          )
        }}
      </div>
      <div class="flex mb-3">
        <label class="flex-1">{{ tr("Raccourci", "Shortcut") }}</label>
        <hotkey-input v-model="pobCompareKey" class="w-48" />
      </div>
      <div class="mb-1">{{ tr("Build utilisé", "Build used") }}</div>
      <div class="flex flex-col gap-1 mb-3">
        <ui-radio :model-value="pobStatus?.source" value="pob" @update:model-value="pobSetSource('pob')">
          {{ tr("Mon build Path of Building (toujours à jour, recommandé)", "My Path of Building build (always up to date, recommended)") }}
        </ui-radio>
        <ui-radio :model-value="pobStatus?.source" value="ninja" @update:model-value="pobSetSource('ninja')">
          {{ tr("Mon personnage sur poe.ninja (mis à jour toutes les quelques heures)", "My character on poe.ninja (updated every few hours)") }}
        </ui-radio>
      </div>

      <template v-if="pobStatus?.source === 'pob'">
        <div class="text-gray-400 mb-2">
          {{
            tr(
              "Dans Path of Building 2 : onglet « Import/Export Build », importe ton personnage, puis enregistre le build (Ctrl + S). À chaque enregistrement, l'overlay recharge le build tout seul : après un changement de gemme ou d'équipement, refais juste Import puis Ctrl + S.",
              "In Path of Building 2: \"Import/Export Build\" tab, import your character, then save the build (Ctrl + S). Each time you save, the overlay reloads the build: after changing a gem or an item, just Import and Ctrl + S again.",
            )
          }}
        </div>
        <div class="flex items-center gap-2 mb-2">
          <span>{{ tr("Build :", "Build:") }}</span>
          <select
            class="p-1 rounded bg-gray-700 flex-1 min-w-0"
            :value="pobStatus.pobBuild ?? ''"
            :disabled="pobBusy"
            @change="pobSetBuild(($event.target as HTMLSelectElement).value)"
          >
            <option value="">
              {{ tr("Le dernier enregistré", "The last saved one") }}{{ pobStatus.builds[0] ? ` (${pobStatus.builds[0].name})` : "" }}
            </option>
            <option v-for="b in pobStatus.builds" :key="b.file" :value="b.file">
              {{ b.name }} · {{ pobAge(b.savedAt) }}
            </option>
          </select>
        </div>
        <div v-if="!pobStatus.builds.length" class="text-yellow-400 mb-2">
          {{ tr("Aucun build enregistré dans", "No build saved in") }} {{ pobStatus.buildsDir }}
        </div>
      </template>

      <div v-if="pobStatus?.source === 'ninja'" class="flex flex-col gap-1 mb-2">
        <ui-radio :model-value="pobMode" value="auto" @update:model-value="pobMode = 'auto'">
          {{ tr("Personnage joué, automatiquement", "Character being played, automatically") }}
        </ui-radio>
        <ui-radio :model-value="pobMode" value="manual" @update:model-value="pobMode = 'manual'">
          {{ tr("Toujours le même personnage", "Always the same character") }}
        </ui-radio>
      </div>
      <template v-if="pobStatus?.source === 'ninja'">
      <div class="mb-1">
        {{
          pobMode === "auto"
            ? tr("Ton compte poe.ninja (lien de ton profil ou d'un de tes personnages)", "Your poe.ninja account (link to your profile or one of your characters)")
            : tr("Lien poe.ninja du personnage", "poe.ninja link of the character")
        }}
      </div>
      <div class="flex gap-2 mb-2">
        <input
          v-model="pobUrl"
          class="rounded bg-gray-900 px-2 py-1 flex-1"
          :placeholder="pobMode === 'auto' ? 'https://poe.ninja/poe2/profile/…' : 'https://poe.ninja/poe2/profile/…/character/…'"
          spellcheck="false"
        />
        <button class="btn" :disabled="pobBusy" @click="pobImport">
          {{ tr("Importer", "Import") }}
        </button>
      </div>
      </template>
      <div class="text-gray-400">
        <div v-if="pobStatus && !pobStatus.pobFound" class="text-red-400">
          {{ tr("Path of Building 2 n'est pas installé sur ce PC (il est nécessaire pour les calculs).", "Path of Building 2 is not installed on this PC (it does the calculations).") }}
        </div>
        <div v-if="pobStatus?.source === 'ninja' && pobMode === 'auto' && pobStatus?.character" class="mb-1">
          {{ tr("Personnage suivi :", "Followed character:") }}
          <b class="text-gray-200">{{ pobStatus.character.name }}</b>
          ({{ pobStatus.character.league }})
          ·
          {{
            pobStatus.character.fromLog
              ? tr("repéré dans le journal du jeu", "seen in the game log")
              : tr("personnage actuel sur poe.ninja", "current character on poe.ninja")
          }}
        </div>
        <template v-if="pobBusy">{{ tr("Chargement du build…", "Loading the build…") }}</template>
        <template v-else-if="pobStatus?.build">
          <div>
            {{ pobStatus.build.className }} {{ tr("niveau", "level") }} {{ pobStatus.build.level }} ·
            {{ Math.round(pobStatus.build.stats.CombinedDPS || pobStatus.build.stats.TotalDPS || 0).toLocaleString(dateLocale()) }} DPS ·
            {{ tr("vie", "life") }} {{ Math.round(pobStatus.build.stats.Life || 0).toLocaleString(dateLocale()) }}
          </div>
          <div class="flex items-center gap-2 mt-2">
            <span>{{ tr("Compétence comparée :", "Compared skill:") }}</span>
            <select
              class="p-1 rounded bg-gray-700"
              :value="pobStatus.build.mainSkill"
              @change="pobSetSkill(Number(($event.target as HTMLSelectElement).value))"
            >
              <option v-for="s in pobStatus.build.skills" :key="s.index" :value="s.index">
                {{ s.label }}
              </option>
            </select>
            <button v-if="pobStatus.source === 'ninja'" class="btn" :disabled="pobBusy" @click="pobRefresh">
              {{ tr("Actualiser depuis poe.ninja", "Refresh from poe.ninja") }}
            </button>
          </div>
          <div v-if="pobStatus.buildInfo.at" class="mt-1" :class="pobBuildOld ? 'text-yellow-400' : ''">
            <template v-if="pobStatus.source === 'pob'">
              {{ tr("Build enregistré dans Path of Building", "Build saved in Path of Building") }}
              {{ pobAge(pobStatus.buildInfo.at) }} ({{ dayTime(pobStatus.buildInfo.at) }})
            </template>
            <template v-else>
              {{ tr("Build relevé sur poe.ninja", "Build read on poe.ninja") }}
              {{ pobAge(pobStatus.buildInfo.at) }} ({{ dayTime(pobStatus.buildInfo.at) }}) ·
              {{ tr("poe.ninja ne met tes personnages à jour que toutes les quelques heures", "poe.ninja only updates your characters every few hours") }}
            </template>
          </div>
        </template>
        <template v-else-if="pobStatus?.source === 'ninja' && pobStatus?.profileUrl">
          {{ tr("Le build sera chargé à la première comparaison.", "The build is loaded at the first comparison.") }}
        </template>
        <div v-if="pobStatus?.error" class="text-red-400 mt-1">
          {{ tr("Échec :", "Failed:") }} {{ pobErrorText }}
        </div>
      </div>
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
    <div class="atz-palette-sub">{{ tr("Thèmes de la Ritualiste", "Ritualist themes") }}</div>
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
      {{ tr("Réinitialiser (Rituel)", "Reset (Ritual)") }}
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
import { buildAge, OLD_BUILD_MS, type PobBuildInfo } from "@/web/overlay/atziri-pob";

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
  rituel: "Ritual",
  cierge: "Candle",
  brume: "Mist",
  sacrifice: "Sacrifice",
};
const BG_NAMES_EN: Record<string, string> = {
  ritualiste: "Ritualist",
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

// --- Compare in Path of Building (main process routes /atziri-pob/*) ---
interface PobStatus {
  pobFound: boolean;
  source: "pob" | "ninja";
  buildsDir: string;
  builds: Array<{ file: string; name: string; savedAt: number }>;
  pobBuild: string | null;
  buildInfo: PobBuildInfo;
  mode: "auto" | "manual";
  account: string | null;
  character: {
    name: string;
    level: number;
    league: string;
    className: string;
    fromLog: boolean;
  } | null;
  profileUrl: string | null;
  fetchedAt: number | null;
  build: {
    className?: string;
    level?: number;
    skills: Array<{ index: number; label: string }>;
    mainSkill: number;
    stats: Record<string, number>;
  } | null;
  error: string | null;
}
const pobStatus = shallowRef<PobStatus | null>(null);
const pobUrl = shallowRef("");
const pobBusy = shallowRef(false);
const pobMode = shallowRef<"auto" | "manual">("auto");
const pobCompareKey = configModelValue(() => itemCheck.value, "pobCompareKey");

async function pobCall(path: string, body?: unknown) {
  pobBusy.value = true;
  try {
    const res = await fetch(`/atziri-pob/${path}`, body === undefined
      ? undefined
      : { method: "POST", body: JSON.stringify(body) });
    const s = (await res.json()) as PobStatus;
    pobStatus.value = s;
    if (!pobUrl.value) {
      pobMode.value = s.mode ?? "auto";
      pobUrl.value =
        pobMode.value === "auto" && s.account
          ? `https://poe.ninja/poe2/profile/${s.account}`
          : s.profileUrl ?? "";
    }
  } catch {
    // dev mode: no main-process routes
  } finally {
    pobBusy.value = false;
  }
}
pobCall("status");

function pobImport() {
  pobCall("profile", { url: pobUrl.value, mode: pobMode.value });
}
function pobRefresh() {
  pobCall("refresh", {});
}
function pobSetSkill(index: number) {
  pobCall("skill", { index });
}
function pobSetSource(source: "pob" | "ninja") {
  pobCall("source", { source });
}
function pobSetBuild(file: string) {
  pobCall("source", { source: "pob", build: file || null });
}
function pobAge(at: number) {
  return buildAge(at, isFrench());
}
const pobBuildOld = computed(() => {
  const info = pobStatus.value?.buildInfo;
  return info?.source === "ninja" && info.at != null && Date.now() - info.at > OLD_BUILD_MS;
});
const pobErrorText = computed(() => {
  const error = pobStatus.value?.error;
  if (error === "no-pob-build") {
    return tr("aucun build enregistré dans Path of Building (importe ton personnage puis Ctrl + S).", "no build saved in Path of Building (import your character, then Ctrl + S).");
  }
  if (error === "pob-build-missing") {
    return tr("le build choisi n'existe plus dans Path of Building.", "the chosen build no longer exists in Path of Building.");
  }
  return error;
});

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

// --- Show on Discord (main process route /atziri-discord) ---
const discord = shallowRef<{ enabled: boolean; connected: boolean } | null>(null);
async function loadDiscord(on?: boolean) {
  try {
    const res = await fetch(
      on == null ? "/atziri-discord" : `/atziri-discord?on=${on ? 1 : 0}`,
      { method: on == null ? "GET" : "POST" },
    );
    discord.value = await res.json();
  } catch {
    // dev mode: no main-process routes
  }
}
loadDiscord();
function setDiscord(on: boolean) {
  loadDiscord(on);
}

// --- Hide the overlay from captures (main process route /atziri-capture) ---
const capture = shallowRef<{ hidden: boolean } | null>(null);
async function loadCapture(hidden?: boolean) {
  try {
    const res = await fetch(
      hidden == null ? "/atziri-capture" : `/atziri-capture?hidden=${hidden ? 1 : 0}`,
      { method: hidden == null ? "GET" : "POST" },
    );
    capture.value = await res.json();
  } catch {
    // dev mode: no main-process routes
  }
}
loadCapture();
function setCapture(hidden: boolean) {
  loadCapture(hidden);
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
  // Ritualist artwork: ritual violet, candle, mist, blood, bone, fog
  "#b57cf0", "#e2a554", "#8fb0e8", "#cf4a5a", "#e6e2d8", "#9d99b4",
  "#d8a24f", "#e8c46a", "#f0d48a", "#c97a3a", "#e07b4f", "#d24b40",
  "#e2654f", "#ff8a5c", "#e7707a", "#d9584a", "#b8475e", "#c06cc4",
  "#c3b8e8", "#8f86e0", "#6aa8e8", "#4fb3d8", "#56c9a6", "#6cc086",
  "#9cc46f", "#c8d36a", "#ebdfc6", "#dde9e3", "#f1e3df", "#e6e4ee",
  "#ffffff", "#d0c8b8", "#a8977b", "#8ea79f", "#b49a96", "#9a97ab",
];
const DARK_SWATCHES = [
  // Ritualist artwork: night forest indigos
  "#0b0c16", "#151629", "#2f2d4c", "#1c1a33", "#24213f", "#3d3a63",
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
  font-family: "Inter", "Segoe UI", system-ui, sans-serif;
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