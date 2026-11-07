<template>
  <!-- Atziri Exchange: Shift + Space hub, styled exactly like the Atziri Regex page (skin "braise") -->
  <div class="ar-hub" @click.stop>
    <header class="ar-top">
      <button type="button" class="ar-settings-btn" @click="openSettings">
        <i class="fas fa-cog"></i>
        <span>{{ tr("Paramètres", "Settings") }}</span>
      </button>
      <div class="ar-brand">
        <img class="ar-logo" src="/icon.png" alt="" width="64" height="64" />
        <h1 class="ar-h1">{{ activeTabLabel }}</h1>
      </div>
      <ConverterBox class="ar-converter-pos" />
      <nav class="ar-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="hubTab === 'market'"
          @click="hubTab = 'market'"
        >
          <img class="ar-tabico" src="/images/tab-marche.webp" alt="" />Economy
          <span v-if="alertCount" class="ar-badge" :title="tr('Alertes de prix', 'Price alerts')">{{
            alertCount
          }}</span>
        </button>
        <button
          v-for="tab in WEB_TABS"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="hubTab === tab.id"
          @click="hubTab = tab.id"
        >
          <i class="fas ar-tabfa" :class="tab.icon"></i>{{ tab.label }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="hubTab === 'regex'"
          @click="hubTab = 'regex'"
        >
          <img class="ar-tabico" src="/icon.png" alt="" />Atziri Regex
        </button>
        <!-- Historique: icon only, far right -->
        <button
          type="button"
          role="tab"
          class="ar-tab-icononly"
          :title="tr('Historique et rentabilité', 'History and profit')"
          :aria-selected="hubTab === 'history'"
          @click="hubTab = 'history'"
        >
          <i class="fas fa-history ar-tabfa"></i>
        </button>
      </nav>
    </header>

    <!-- New Atziri Exchange installer published on GitHub -->
    <a
      v-if="atziriUpdate"
      class="ar-update"
      :href="atziriUpdate.url"
      target="_blank"
      rel="noreferrer"
    >
      <i class="fas fa-download"></i>
      {{
        tr(
          "Nouvelle version d'Atziri Exchange disponible : clique pour la télécharger.",
          "A new Atziri Exchange version is available: click to download it.",
        )
      }}
    </a>

    <!-- One web page per tab, kept alive (v-show) so each keeps its state -->
    <WebPane
      v-for="tab in WEB_TABS"
      v-show="hubTab === tab.id"
      :key="tab.id"
      :tab="tab"
    />

    <RegexPane v-show="hubTab === 'regex'" />
    <HistoryPane v-if="hubTab === 'history'" />

    <div v-show="hubTab === 'market'" class="ar-body">
      <fieldset class="ar-nav">
        <legend>{{ tr("Catégories", "Categories") }}</legend>
        <button
          type="button"
          :aria-pressed="selectedType === FAV_TYPE"
          @click="selectedType = FAV_TYPE"
        >
          <i class="fas fa-star ar-catico ar-star-ico"></i>
          <span>{{ tr("Favoris", "Favorites") }}</span>
          <span v-if="alertCount" class="ar-badge ml-auto">{{
            alertCount
          }}</span>
        </button>
        <!-- drag and drop to reorder (remembered) -->
        <button
          v-for="cat in orderedCategories"
          :key="cat.type"
          type="button"
          draggable="true"
          class="ar-cat"
          :class="{ 'is-drop': dropTarget === cat.type }"
          :aria-pressed="cat.type === selectedType"
          @click="selectedType = cat.type"
          @dragstart="onDragStart(cat.type, $event)"
          @dragover.prevent="dropTarget = cat.type"
          @dragleave="dropTarget = dropTarget === cat.type ? null : dropTarget"
          @drop.prevent="onDrop(cat.type)"
          @dragend="dropTarget = null"
        >
          <img
            v-if="categoryIcon(cat.type)"
            :src="categoryIcon(cat.type)"
            alt=""
            class="ar-catico"
          />
          <span>{{ categoryLabel(cat.type) }}</span>
        </button>
      </fieldset>

      <section class="ar-main">
        <div class="ar-main-head">
          <h2>{{ categoryLabel(selectedType) }}</h2>
          <div class="ar-sub">
            {{ tr("7 j", "7 d") }} · {{ leagueName }}
            <template v-if="updatedAtText"> · {{ updatedAtText }}</template>
            · poe.ninja{{ isLive ? tr(" (direct)", " (live)") : "" }}
          </div>
          <div v-if="selectedType === FAV_TYPE" class="ar-fav-settings">
            {{ tr("Alerte si le prix bouge de plus de", "Alert when the price moves more than") }}
            <input
              v-model.number="alertThreshold"
              type="number"
              min="1"
              class="ar-search ar-threshold"
            />
            {{ tr("% depuis l'ajout aux favoris.", "% since it was added to favorites.") }}
            <span class="ar-muted">{{ tr("Clique sur une alerte pour la remettre à zéro.", "Click an alert to reset it.") }}</span>
          </div>
        </div>

        <input
          v-model.trim="search"
          type="text"
          class="ar-search"
          :placeholder="tr('Rechercher des objets...', 'Search items...')"
          spellcheck="false"
        />

        <div v-if="!rows.length" class="ar-empty">
          <template v-if="loading">{{ tr("Chargement des prix…", "Loading prices…") }}</template>
          <template v-else-if="!categories.length"
            >{{ tr("Aucun prix disponible pour cette ligue.", "No prices for this league.") }}</template
          >
          <template v-else-if="selectedType === FAV_TYPE && !favorites.length"
            >{{ tr("Clique sur l'étoile d'un objet pour l'ajouter à tes favoris.", "Click the star of an item to add it to your favorites.") }}</template
          >
          <template v-else>{{ tr("Aucun objet trouvé.", "No item found.") }}</template>
        </div>

        <div v-else class="ar-table">
          <div class="ar-row ar-row--head">
            <div>{{ tr("Objet", "Item") }}</div>
            <button
              type="button"
              class="ar-sort ar-price"
              @click="setSort('price')"
            >
              <span>Divine{{ sortMark("price") }}</span>
              <span>Chaos</span>
            </button>
            <button type="button" class="ar-sort" @click="setSort('volume')">
              Volume{{ sortMark("volume") }}
            </button>
            <div class="ar-center">{{ tr("Historique", "History") }}</div>
            <button type="button" class="ar-sort" @click="setSort('change')">
              {{ tr("7 j", "7 d") }}{{ sortMark("change") }}
            </button>
          </div>
          <div class="ar-list">
            <div
              v-for="row in rows"
              :key="row.key"
              class="ar-row"
              :title="row.refName"
            >
              <div class="ar-item">
                <button
                  type="button"
                  class="ar-star"
                  :class="{ 'is-on': row.isFav }"
                  :title="row.isFav ? tr('Retirer des favoris', 'Remove from favorites') : tr('Ajouter aux favoris', 'Add to favorites')"
                  @click="toggleFav(row)"
                >
                  <i :class="row.isFav ? 'fas fa-star' : 'far fa-star'"></i>
                </button>
                <img v-if="row.icon" :src="row.icon" class="ar-icon" />
                <span
                  v-if="row.ns === 'UNIQUE'"
                  class="truncate ar-unique-link"
                  :title="tr('Voir cet unique sur le site de trade', 'Open this unique on the trade site')"
                  @click="openUniqueOnTrade(row)"
                  >{{ row.name }}
                  <i class="fas fa-external-link-alt"></i
                ></span>
                <span v-else class="truncate">{{ row.name }}</span>
                <button
                  v-if="row.alert"
                  type="button"
                  class="ar-alert"
                  :class="row.sinceFav >= 0 ? 'ar-ok' : 'ar-bad'"
                  :title="tr('Variation depuis l\'ajout aux favoris (clic : remettre à zéro)', 'Change since added to favorites (click: reset)')"
                  @click="ackAlert(row)"
                >
                  {{ row.sinceFav >= 0 ? "▲ +" : "▼ "
                  }}{{ row.sinceFav.toFixed(0) }} %
                </button>
              </div>
              <!-- Divine Orbs on the left, Chaos Orbs on the right -->
              <div class="ar-price">
                <div class="ar-price-cell">
                  <template v-if="row.divText">
                    {{ row.divText }}
                    <img src="/images/divine.png" class="ar-cur" />
                  </template>
                </div>
                <div class="ar-price-cell ar-price-chaos">
                  {{ row.chaosText }}
                  <img :src="row.chaosIcon" class="ar-cur" />
                </div>
              </div>
              <div class="ar-num ar-muted">{{ row.volumeText }}</div>
              <div class="ar-spark">
                <svg viewBox="0 0 100 24" preserveAspectRatio="none">
                  <polyline
                    :points="row.sparkPoints"
                    fill="none"
                    :stroke="row.change >= 0 ? '#9cc46f' : '#d9584a'"
                    stroke-width="1.6"
                    vector-effect="non-scaling-stroke"
                  />
                </svg>
              </div>
              <div
                class="ar-num"
                :class="row.change >= 0 ? 'ar-ok' : 'ar-bad'"
              >
                {{ row.change >= 0 ? "+" : "" }}{{ row.change.toFixed(2) }} %
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  onMounted,
  onUnmounted,
  shallowRef,
  watch,
} from "vue";
import { AppConfig } from "@/web/Config";
import { tr, isFrench, dateLocale } from "@/web/atziri-lang";
import type { WidgetManager } from "./interfaces";
import { hubTab, WEB_TABS, openInHub } from "./atziri-hub";
import { poeWebApi } from "@/web/Config";
import WebPane from "./WebPane.vue";
import RegexPane from "./RegexPane.vue";
import HistoryPane from "./HistoryPane.vue";
import ConverterBox from "./ConverterBox.vue";
import { setRates } from "./atziri-money";
import {
  favorites,
  alertThreshold,
  favKey,
  toggleFavorite,
  acknowledgeAlert,
  changeSince,
  type Favorite,
} from "./atziri-favorites";
import {
  usePoeninja,
  displayRounding,
  type MarketCategory,
  type MarketLine,
} from "@/web/background/Prices";
import { useLeagues } from "@/web/background/Leagues";
import { ITEM_BY_REF } from "@/assets/data";
import { Host } from "@/web/background/IPC";

const CATEGORY_LABELS: Record<string, string> = {
  Currency: "Objets monétaires",
  Fragments: "Fragments",
  Abyss: "Abysse",
  UncutGems: "Gemmes brutes",
  LineageSupportGems: "Gemmes de lignée",
  Essences: "Essences",
  Ultimatum: "Noyaux d'âme",
  Idols: "Idoles",
  Runes: "Runes",
  Ritual: "Présages",
  Expedition: "Expédition",
  Delirium: "Délire",
  Breach: "Brèche",
  Verisium: "Vérisium",
  UniqueWeapons: "Armes uniques",
  UniqueArmours: "Armures uniques",
  UniqueAccessories: "Bijoux uniques",
  UniqueFlasks: "Flacons uniques",
  UniqueCharms: "Charmes uniques",
  UniqueJewels: "Joyaux uniques",
  UniqueTablets: "Tablettes uniques",
  UniqueSanctumRelics: "Reliques uniques",
  PrecursorTablets: "Tablettes de précurseur",
  // categories poe.ninja may add later
  Omens: "Présages",
  SoulCores: "Noyaux d'âme",
  Catalysts: "Catalyseurs",
  Waystones: "Pierres de passage",
  Maps: "Cartes",
  Tablets: "Tablettes",
  Talismans: "Talismans",
  Splinters: "Éclats",
  Distilled: "Émotions distillées",
  DistilledEmotions: "Émotions distillées",
  Gems: "Gemmes",
  SkillGems: "Gemmes de compétence",
  SupportGems: "Gemmes de soutien",
  SpiritGems: "Gemmes d'esprit",
  Jewels: "Joyaux",
  Charms: "Charmes",
  Relics: "Reliques",
  Keys: "Clés",
  Artifacts: "Artéfacts",
  Logbooks: "Journaux d'expédition",
  Sanctum: "Sanctum",
  Incursion: "Incursion",
  Delve: "Exploration",
  Heist: "Casse",
  UniqueMaps: "Cartes uniques",
  UniqueRelics: "Reliques uniques",
  UniqueWaystones: "Pierres de passage uniques",
};

// English names, as on poe.ninja (other types: "UniqueWeapons" -> "Unique Weapons")
const CATEGORY_LABELS_EN: Record<string, string> = {
  Ultimatum: "Soul Cores",
  Ritual: "Omens",
  UncutGems: "Uncut Gems",
  LineageSupportGems: "Lineage Gems",
  UniqueSanctumRelics: "Unique Relics",
};

// Word by word fallback for a category nobody has named yet
// ("UniqueBelts" -> "Ceintures uniques", "SoulEchoes" -> "Soul Echoes")
const CATEGORY_WORDS: Record<string, string> = {
  Weapons: "Armes",
  Armours: "Armures",
  Accessories: "Bijoux",
  Belts: "Ceintures",
  Rings: "Anneaux",
  Amulets: "Amulettes",
  Flasks: "Flacons",
  Charms: "Charmes",
  Jewels: "Joyaux",
  Gems: "Gemmes",
  Runes: "Runes",
  Tablets: "Tablettes",
  Relics: "Reliques",
  Maps: "Cartes",
  Waystones: "Pierres de passage",
  Fragments: "Fragments",
  Splinters: "Éclats",
  Essences: "Essences",
  Omens: "Présages",
  Catalysts: "Catalyseurs",
  Idols: "Idoles",
  Keys: "Clés",
  Currency: "Objets monétaires",
  Shields: "Boucliers",
  Quivers: "Carquois",
  Foci: "Focalisateurs",
};

function autoCategoryLabel(type: string) {
  const words = type.match(/[A-Z][a-z]*|[0-9]+/g) ?? [type];
  const unique = words[0] === "Unique" && words.length > 1;
  const rest = (unique ? words.slice(1) : words).join("");
  const known = CATEGORY_LABELS[rest] ?? CATEGORY_WORDS[rest];
  if (known) return unique ? `${known} uniques` : known;
  return words.join(" ");
}

// Category icons, as shown in the poe.ninja economy sidebar
const POECDN = "https://web.poecdn.com/gen/image/";
const CATEGORY_ICONS: Record<string, string> = {
  Currency: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lNb2RWYWx1ZXMiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/2986e220b3/CurrencyModValues.png",
  Fragments: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQnJlYWNoL0JyZWFjaHN0b25lIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/d60587d724/Breachstone.png",
  Abyss: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQWJ5c3NhbEV5ZVNvY2tldGFibGVzL1RlY3JvZHNHYXplIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/ef2a9355b4/TecrodsGaze.png",
  UncutGems: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvR2Vtcy9VbmN1dFN1cHBvcnRHZW0iLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/d1ffe1c951/UncutSupportGem.png",
  LineageSupportGems: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvR2Vtcy9OZXcvTmV3U3VwcG9ydC9MaW5lYWdlL1dpbGRzaGFyZHMiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/6d700adf17/Wildshards.png",
  Essences: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvRXNzZW5jZS9HcmVhdGVyQXR0cmlidXRlRXNzZW5jZSIsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/8a8cb823af/GreaterAttributeEssence.png",
  Ultimatum: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvU291bENvcmVzL0dyZWF0ZXJTb3VsQ29yZU1hbmEiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/1437190de2/GreaterSoulCoreMana.png",
  Idols: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvVG9ybWVudGVkU3Bpcml0U29ja2V0YWJsZXMvQXptZXJpU29ja2V0YWJsZU1vbmtleVNwZWNpYWwiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/8ffc9986a0/AzmeriSocketableMonkeySpecial.png",
  Runes: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvUnVuZXMvTGlnaHRuaW5nUnVuZSIsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/98319b3998/LightningRune.png",
  Ritual: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvT21lbnMvVm9vZG9vT21lbnMzUmVkIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/9cfdcc9e1a/VoodooOmens3Red.png",
  Expedition: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvRXhwZWRpdGlvbi9CYXJ0ZXJSZWZyZXNoQ3VycmVuY3kiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/8a4fe1f468/BarterRefreshCurrency.png",
  Delirium: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvRGlzdGlsbGVkRW1vdGlvbnMvRGlzdGlsbGVkUGFyYW5vaWEiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/279e807e8f/DistilledParanoia.png",
  Breach: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQnJlYWNoL0JyZWFjaENhdGFseXN0TWFuYSIsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/61d3a7a832/BreachCatalystMana.png",
  Verisium: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvRXhwZWRpdGlvbjIvUmVmaW5lZFZlcmlzaXVtIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/35616acb9f/RefinedVerisium.png",
  UniqueWeapons: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvV2VhcG9ucy9PbmVIYW5kV2VhcG9ucy9PbmVIYW5kTWFjZXMvVW5pcXVlcy9Nam9sbmVyIiwidyI6MiwiaCI6Mywic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/9216de28a2/Mjolner.png",
  UniqueArmours: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQXJtb3Vycy9HbG92ZXMvVW5pcXVlcy9NYWxpZ2Fyb3NWaXJ0dW9zaXR5IiwidyI6MiwiaCI6Miwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/08f6808733/MaligarosVirtuosity.png",
  UniqueAccessories: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQmVsdHMvVW5pcXVlcy9IZWFkaHVudGVyIiwidyI6MiwiaCI6MSwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/24accb4eec/Headhunter.png",
  UniqueFlasks: POECDN + "WzksMTQseyJmIjoiMkRJdGVtcy9GbGFza3MvVW5pcXVlcy9MYXZpYW5nYXNTcGlyaXQiLCJ3IjoxLCJoIjoyLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIiwibGV2ZWwiOjF9XQ/ef79cd6b0d/LaviangasSpirit.png",
  UniqueCharms: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQ2hhcm1zL1VuaXF1ZXMvUnVieVVuaXF1ZUNoYXJtIiwidyI6MSwiaCI6MSwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/f88d02b00c/RubyUniqueCharm.png",
  UniqueJewels: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvSmV3ZWxzL1VuaXF1ZXMvR3JhbmRTcGVjdHJ1bV9SdWJ5IiwidyI6MSwiaCI6MSwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/8d964b3e88/GrandSpectrum_Ruby.png",
  UniqueSanctumRelics: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvUmVsaWNzL1JlbGljVW5pcXVlMXgzIiwidyI6MSwiaCI6Mywic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/9a0c871b8b/RelicUnique1x3.png",
  UniqueTablets: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvUHJlY3Vyc29yVGFibGV0cy9QcmVjdXJzb3JUYWJsZXRBYnlzc1VuaXF1ZTEiLCJ3IjoxLCJoIjoxLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/a5c2d8a638/PrecursorTabletAbyssUnique1.png",
  PrecursorTablets: POECDN + "WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvUHJlY3Vyc29yVGFibGV0cy9QcmVjdXJzb3JUYWJsZXRBYnlzc1VuaXF1ZTEiLCJ3IjoxLCJoIjoxLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/a5c2d8a638/PrecursorTabletAbyssUnique1.png",
};

const CURRENCY_ICONS: Record<string, string> = {
  exalted: "/images/exa.png",
  chaos: "/images/chaos.png",
  div: "/images/divine.png",
};

const props = defineProps<{ visible: boolean }>();

const ninja = usePoeninja();
const leagues = useLeagues();
const wm = inject<WidgetManager>("wm")!;

// when the page opens, refresh what may have gone stale while it was closed
watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    ninja.queuePricesFetch();
    if (selectedType.value === FAV_TYPE) fetchFavorites();
    else fetchLive(selectedType.value);
  },
);

// Hub title follows the active tab
const activeTabLabel = computed(() => {
  if (hubTab.value === "market") return "Economy";
  if (hubTab.value === "regex") return "Atziri Regex";
  if (hubTab.value === "history") return tr("Historique", "History");
  return WEB_TABS.find((t) => t.id === hubTab.value)?.label ?? "";
});

const FAV_TYPE = "__favorites";

// Settings page: opens the settings widget inside the Atziri frame
function openSettings() {
  const settings = AppConfig().widgets.find((w) => w.wmType === "settings");
  if (settings) wm.show(settings.wmId);
}

const selectedType = shallowRef("Currency");
const search = shallowRef("");
const sortBy = shallowRef<"price" | "volume" | "change">("price");
const sortDesc = shallowRef(true);

// --- Live data straight from poe.ninja (exchange categories) ---
interface LiveCategory {
  lines: Array<MarketLine & { icon?: string }>;
  chaosPerDivine?: number;
  exaltedPerDivine?: number;
  at: number;
}
const LIVE_REFRESH_MS = 5 * 60 * 1000;
const live = shallowRef(new Map<string, LiveCategory>());
const liveLoading = shallowRef(false);

async function fetchLive(type: string, force = false, silent = false) {
  const league = leagues.selectedId.value;
  const cat = categories.value.find((c) => c.type === type);
  if (!league || !cat || !cat.cx) return;
  const cached = live.value.get(`${league}|${type}`);
  if (!force && cached && Date.now() - cached.at < 60 * 1000) return;

  if (!silent) liveLoading.value = true;
  try {
    const query = `league=${encodeURIComponent(league).replace(/%20/g, "+")}&type=${encodeURIComponent(type)}`;
    const res = await Host.proxy(
      `poe.ninja/poe2/api/economy/exchange/current/overview?${query}`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      core?: { rates?: Record<string, number> };
      lines?: Array<{
        id: string;
        primaryValue: number;
        volumePrimaryValue?: number;
        sparkline?: { totalChange: number; data: Array<number | null> };
      }>;
      items?: Array<{
        id: string;
        name: string;
        image?: string;
        detailsId: string;
      }>;
    };
    const items = new Map((data.items ?? []).map((i) => [i.id, i]));
    const lines = (data.lines ?? []).flatMap((line) => {
      const item = items.get(line.id);
      if (!item) return [];
      return [
        {
          name: item.name,
          primaryValue: line.primaryValue,
          volumePrimaryValue: line.volumePrimaryValue,
          detailsId: item.detailsId,
          sparkline: line.sparkline ?? { totalChange: 0, data: [] },
          icon: item.image ? `https://web.poecdn.com${item.image}` : undefined,
        },
      ];
    });
    const next = new Map(live.value);
    next.set(`${league}|${type}`, {
      lines,
      chaosPerDivine: data.core?.rates?.chaos,
      exaltedPerDivine: data.core?.rates?.exalted,
      at: Date.now(),
    });
    live.value = next;
  } catch (e) {
    console.warn("poe.ninja live prices failed", e);
  } finally {
    if (!silent) liveLoading.value = false;
  }
}

// --- New Atziri Exchange version (checked by the main process) ---
const atziriUpdate = shallowRef<{ build: number; url: string } | null>(null);
async function loadAtziriUpdate() {
  try {
    const s = await (await fetch("/atziri-data/status")).json();
    const u = s?.atziriUpdate;
    atziriUpdate.value =
      u && typeof u.url === "string" && u.url.startsWith("https://github.com/")
        ? u
        : null;
  } catch {
    // dev mode: no main-process routes
  }
}
watch(
  () => props.visible,
  (v) => {
    if (v) loadAtziriUpdate();
  },
  { immediate: true },
);

let refreshTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  ninja.queuePricesFetch();
  fetchLive(selectedType.value);
  refreshTimer = setInterval(() => {
    // nothing to refresh while the Shift + Space page is closed
    if (!props.visible) return;
    fetchLive(selectedType.value, true);
    for (const type of new Set(favorites.value.map((f) => f.type))) {
      if (type !== selectedType.value) fetchLive(type, true);
    }
  }, LIVE_REFRESH_MS);
});
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});

const categories = computed<readonly MarketCategory[]>(
  () => ninja.marketOverviews.value as readonly MarketCategory[],
);

watch(
  categories,
  (cats) => {
    if (
      cats.length &&
      selectedType.value !== FAV_TYPE &&
      !cats.some((c) => c.type === selectedType.value)
    ) {
      selectedType.value = cats[0].type;
    }
    fetchLive(selectedType.value);
    // new categories: load them quietly once, to borrow an item icon
    for (const cat of cats) {
      if (cat.cx && !CATEGORY_ICONS[cat.type] && cat.type !== selectedType.value) {
        fetchLive(cat.type, false, true);
      }
    }
  },
  { immediate: true },
);
watch(selectedType, (type) => fetchLive(type));
watch(
  () => leagues.selectedId.value,
  () => fetchLive(selectedType.value, true),
);

const liveEntry = computed(() =>
  live.value.get(`${leagues.selectedId.value}|${selectedType.value}`),
);
const isLive = computed(() => liveEntry.value != null);

const loading = computed(() => ninja.initialLoading() || liveLoading.value);
const leagueName = computed(() => leagues.selectedId.value ?? "");
const updatedAtText = computed(() => {
  const t = liveEntry.value?.at ?? ninja.marketUpdatedAt.value;
  if (!t) return "";
  return new Date(t).toLocaleString(dateLocale(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
});

// --- Category order, changed by drag and drop, remembered on this PC ---
const ORDER_KEY = "atziri-category-order";
function loadOrder(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "null");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
const categoryOrder = shallowRef<string[]>(loadOrder());
const dropTarget = shallowRef<string | null>(null);
let dragged: string | null = null;

const orderedCategories = computed(() => {
  const pos = (t: string) => {
    const i = categoryOrder.value.indexOf(t);
    return i === -1 ? 1000 : i;
  };
  return [...categories.value].sort((a, b) => pos(a.type) - pos(b.type));
});

function onDragStart(type: string, e: DragEvent) {
  dragged = type;
  e.dataTransfer?.setData("text/plain", type);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
}

function onDrop(target: string) {
  dropTarget.value = null;
  if (!dragged || dragged === target) return;
  const order = orderedCategories.value.map((c) => c.type);
  const from = order.indexOf(dragged);
  order.splice(from, 1);
  order.splice(order.indexOf(target) + (from <= order.indexOf(target) ? 1 : 0), 0, dragged);
  categoryOrder.value = order;
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  } catch {
    // ignore unavailable storage
  }
  dragged = null;
}

// --- Unique items: open their trade search in the Trade tab ---
function openUniqueOnTrade(row: Row) {
  if (row.ns !== "UNIQUE") return;
  const league = leagues.selectedId.value;
  if (!league) return;
  const site = poeWebApi() ?? "www.pathofexile.com";
  const useEn = site === "www.pathofexile.com";
  const unique = ITEM_BY_REF("UNIQUE", row.refName)?.[0];
  const base = row.variant ? ITEM_BY_REF("ITEM", row.variant)?.[0] : undefined;
  const query: Record<string, unknown> = {
    // "securable" = Achat instantané on the trade site
    status: { option: "securable" },
    name: useEn ? row.refName : (unique?.name ?? row.refName),
  };
  if (row.variant) query.type = useEn ? row.variant : (base?.name ?? row.variant);
  // "Exalted or Divine" price filter, like the Ctrl + D searches
  query.filters = {
    trade_filters: { filters: { price: { option: "exalted_divine" } } },
  };
  const q = encodeURIComponent(JSON.stringify({ query }));
  openInHub(
    `https://${site}/trade2/search/poe2/${encodeURIComponent(league)}?q=${q}`,
    "trade",
  );
}

function categoryLabel(type: string) {
  if (type === FAV_TYPE) return tr("Favoris", "Favorites");
  if (!isFrench()) {
    return (
      CATEGORY_LABELS_EN[type] ??
      (type.match(/[A-Z][a-z]*|[0-9]+/g) ?? [type]).join(" ")
    );
  }
  return CATEGORY_LABELS[type] ?? autoCategoryLabel(type);
}

// Known icon, or else the icon of the category's first item (new categories)
function categoryIcon(type: string): string | undefined {
  if (CATEGORY_ICONS[type]) return CATEGORY_ICONS[type];
  const entry = live.value.get(`${leagues.selectedId.value}|${type}`);
  return entry?.lines.find((l) => l.icon)?.icon;
}

function setSort(key: "price" | "volume" | "change") {
  if (sortBy.value === key) {
    sortDesc.value = !sortDesc.value;
  } else {
    sortBy.value = key;
    sortDesc.value = true;
  }
}

function sortMark(key: string) {
  if (sortBy.value !== key) return "";
  return sortDesc.value ? " ▼" : " ▲";
}

function sparkPoints(data: Array<number | null>): string {
  const values = data.filter((v): v is number => v != null);
  if (!values.length) return "";
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const step = data.length > 1 ? 100 / (data.length - 1) : 100;
  const pts: string[] = [];
  data.forEach((v, i) => {
    if (v == null) return;
    const x = i * step;
    const y = 22 - ((v - min) / span) * 20;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  return pts.join(" ");
}

// Chaos per Divine, from live data or the background price snapshot
const chaosPerDivine = computed<number | undefined>(() => {
  if (liveEntry.value?.chaosPerDivine) return liveEntry.value.chaosPerDivine;
  for (const entry of live.value.values()) {
    if (entry.chaosPerDivine) return entry.chaosPerDivine;
  }
  const cur = ninja.xchgRateCurrency.value;
  if (cur?.id === "chaos" && ninja.xchgRate.value) return ninja.xchgRate.value;
  return undefined;
});

// Exalted per Divine, from live data or the background price snapshot
const exaltedPerDivine = computed<number | undefined>(() => {
  if (liveEntry.value?.exaltedPerDivine) return liveEntry.value.exaltedPerDivine;
  // categories without live data (uniques) reuse the rate of any live one
  for (const entry of live.value.values()) {
    if (entry.exaltedPerDivine) return entry.exaltedPerDivine;
  }
  const cur = ninja.xchgRateCurrency.value;
  if (cur?.id === "exalted" && ninja.xchgRate.value) return ninja.xchgRate.value;
  return undefined;
});

/**
 * Left: Divine Orbs, only when worth at least 1 Divine.
 * Right: Chaos Orbs, or Exalted Orbs when worth less than 1 Chaos.
 */
function formatPrice(divines: number) {
  const chaosRate = chaosPerDivine.value;
  const exaRate = exaltedPerDivine.value;
  const divText = divines >= 1 ? displayRounding(divines, false, true) : "";
  const chaos = chaosRate ? divines * chaosRate : undefined;

  if (chaos != null && chaos < 1 && exaRate) {
    return {
      divText,
      chaosText: displayRounding(divines * exaRate, true, true),
      chaosIcon: CURRENCY_ICONS.exalted,
    };
  }
  return {
    divText,
    chaosText: chaos != null ? displayRounding(chaos, true, true) : "—",
    chaosIcon: CURRENCY_ICONS.chaos,
  };
}

// share the rates with the converter and the history tab
watch([chaosPerDivine, exaltedPerDivine], ([c, e]) => setRates(c, e), {
  immediate: true,
});

type RowLine = MarketLine & { icon?: string };

/** Lines of a category: live poe.ninja data when loaded, else the snapshot */
function linesFor(type: string): readonly RowLine[] {
  const liveLines = live.value.get(`${leagues.selectedId.value}|${type}`)?.lines;
  if (liveLines) return liveLines;
  return (categories.value.find((c) => c.type === type)?.lines ??
    []) as readonly RowLine[];
}

function findFavLine(fav: Favorite) {
  return linesFor(fav.type).find(
    (l) => l.name === fav.name && (l.variant ?? "") === (fav.variant ?? ""),
  );
}

function buildRow(cat: MarketCategory, line: RowLine) {
  const base = ITEM_BY_REF(cat.ns as "ITEM", line.name)?.[0];
  const name = base?.name ?? line.name;
  const volume = line.volumePrimaryValue ?? 0;
  const fav = favorites.value.find(
    (f) =>
      favKey(f) ===
      favKey({ type: cat.type, name: line.name, variant: line.variant }),
  );
  const sinceFav = fav ? changeSince(fav, line.primaryValue) : 0;
  return {
    key: `${cat.type}:${line.detailsId}:${line.variant ?? ""}`,
    type: cat.type,
    ns: cat.ns,
    refName: line.name,
    variant: line.variant,
    name: line.variant
      ? `${name} (${ITEM_BY_REF("ITEM", line.variant)?.[0]?.name ?? line.variant})`
      : name,
    icon: base?.icon ?? line.icon,
    value: line.primaryValue,
    ...formatPrice(line.primaryValue),
    volume,
    volumeText: volume ? displayRounding(volume, false, true) : "—",
    change: line.sparkline?.totalChange ?? 0,
    sparkPoints: sparkPoints(line.sparkline?.data ?? []),
    isFav: Boolean(fav),
    sinceFav,
    alert: Boolean(fav) && Math.abs(sinceFav) >= alertThreshold.value,
  };
}

type Row = ReturnType<typeof buildRow>;

function toggleFav(row: Row) {
  toggleFavorite({
    type: row.type,
    ns: row.ns,
    name: row.refName,
    variant: row.variant,
    refPrice: row.value,
  });
}

function ackAlert(row: Row) {
  acknowledgeAlert(
    favKey({ type: row.type, name: row.refName, variant: row.variant }),
    row.value,
  );
}

/** Number of favorites whose price moved past the alert threshold */
const alertCount = computed(
  () =>
    favorites.value.filter((f) => {
      const line = findFavLine(f);
      return (
        line &&
        Math.abs(changeSince(f, line.primaryValue)) >= alertThreshold.value
      );
    }).length,
);

// keep favorites' categories up to date with live data
function fetchFavorites() {
  for (const type of new Set(favorites.value.map((f) => f.type))) {
    fetchLive(type);
  }
}
watch(selectedType, (t) => {
  if (t === FAV_TYPE) fetchFavorites();
});
watch(categories, fetchFavorites);

const rows = computed(() => {
  const query = search.value.toLowerCase();
  let list: Row[];
  if (selectedType.value === FAV_TYPE) {
    list = favorites.value.flatMap((f) => {
      const cat = categories.value.find((c) => c.type === f.type);
      const line = findFavLine(f);
      return cat && line ? [buildRow(cat, line)] : [];
    });
  } else {
    const cat = categories.value.find((c) => c.type === selectedType.value);
    if (!cat) return [];
    list = linesFor(cat.type).map((line) => buildRow(cat, line));
  }

  const filtered = query
    ? list.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.refName.toLowerCase().includes(query),
      )
    : list;

  const dir = sortDesc.value ? -1 : 1;
  const key = sortBy.value;
  return filtered.sort((a, b) => {
    const av = key === "price" ? a.value : key === "volume" ? a.volume : a.change;
    const bv = key === "price" ? b.value : key === "volume" ? b.volume : b.change;
    return (av - bv) * dir;
  });
});
</script>

<style lang="postcss">
/* Values copied from the Atziri Regex page, skin "braise" */
.ar-hub {
  --bg: rgb(var(--c-gray-900));
  --surface: rgb(var(--c-gray-800) / 0.92);
  --line: rgb(var(--c-gray-700));
  --fg: rgb(var(--c-gray-200));
  --muted: rgb(var(--c-gray-400));
  --accent: rgb(var(--c-blue-400));
  --accent-soft: rgb(var(--c-blue-900));
  --ok: #9cc46f;
  --bad: #d9584a;
  --display: "Cinzel", "Marcellus", Georgia, serif;
  --body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Consolas, monospace;

  position: absolute;
  top: calc(var(--atz-y, 7vh) + 0.75rem);
  bottom: calc(var(--atz-y, 7vh) + 1.25rem);
  left: calc(var(--atz-x, 10vw) + 1.5rem);
  right: calc(var(--atz-x, 10vw) + 1.5rem);
  z-index: 1;
  display: flex;
  flex-direction: column;
  color: var(--fg);
  font-family: var(--body);
  font-size: 15px;
  line-height: 1.45;
}

.ar-hub button {
  font: inherit;
  cursor: pointer;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--fg);
  padding: 8px 14px;
}

.ar-hub button:hover {
  border-color: var(--accent);
}

/* header.top + .brand + .logo + h1 */
.ar-top {
  position: relative;
  padding-block: 4px 0;
}

.ar-hub .ar-settings-btn {
  position: absolute;
  top: 4px;
  left: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-family: var(--display);
  letter-spacing: 0.06em;
  font-size: 0.95rem;
  color: var(--muted);
}

.ar-hub .ar-settings-btn:hover {
  color: var(--accent);
}

.ar-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.ar-logo {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid var(--accent);
  box-shadow:
    0 0 0 4px rgba(0, 0, 0, 0.45),
    0 0 22px color-mix(in srgb, var(--accent) 45%, transparent);
  object-fit: cover;
  flex: none;
}

.ar-h1 {
  font-family: var(--display);
  margin: 0;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 700;
  font-size: 1.7rem;
}

.ar-h1::after {
  content: "";
  display: block;
  width: 120px;
  height: 1px;
  margin-top: 10px;
  background: linear-gradient(90deg, var(--accent), transparent);
}

/* new version notice */
.ar-hub .ar-update {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 0;
  padding: 6px 12px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--surface);
  color: var(--fg);
  text-decoration: none;
}

.ar-hub .ar-update:hover {
  color: var(--accent);
}

/* .tabs */
.ar-tabs {
  display: flex;
  gap: 4px;
  margin-top: 14px;
  border-bottom: 1px solid var(--line);
}

.ar-hub .ar-tabs button {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  background: transparent;
  color: var(--muted);
  padding: 8px 16px;
  font-family: var(--display);
  letter-spacing: 0.06em;
  font-size: 1.05rem;
  margin-bottom: -1px;
}

.ar-hub .ar-tabs button[aria-selected="true"] {
  background: var(--surface);
  border-color: var(--line);
  color: var(--fg);
  border-bottom: 1px solid var(--surface);
}

.ar-tabico {
  width: 22px;
  height: 22px;
  object-fit: contain;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
  opacity: 0.75;
}

/* Converter, top right of the header */
.ar-converter-pos {
  position: absolute;
  top: 4px;
  right: 0;
}

.ar-converter {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  font-family: var(--mono);
  font-size: 13px;
}

.ar-hub .ar-conv-input {
  width: 4.5rem;
  padding: 3px 6px;
}

.ar-conv-from {
  display: flex;
  gap: 2px;
}

.ar-hub .ar-conv-from button {
  padding: 2px;
  border-radius: 5px;
  background: transparent;
  border-color: transparent;
  opacity: 0.55;

  img {
    width: 22px;
    height: 22px;
  }

  &[aria-pressed="true"] {
    opacity: 1;
    border-color: var(--accent);
    background: var(--accent-soft);
  }
}

.ar-conv-eq {
  color: var(--muted);
}

.ar-conv-out {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 5.5rem;
}

.ar-conv-val {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;

  img {
    width: 16px;
    height: 16px;
  }
}

.ar-hub .ar-tabs .ar-tab-icononly {
  margin-left: auto;
  padding: 8px 14px;
  gap: 0;
}

.ar-hub .ar-cat {
  cursor: grab;

  &.is-drop {
    border-top: 2px solid var(--accent);
  }
}

.ar-unique-link {
  cursor: pointer;
  color: rgb(var(--c-blue-300));

  i {
    font-size: 10px;
    opacity: 0.6;
    margin-left: 3px;
  }

  &:hover {
    text-decoration: underline;
  }
}

/* Alerts and favorites */
.ar-badge {
  display: inline-block;
  min-width: 1.2rem;
  padding: 0 5px;
  margin-left: 4px;
  border-radius: 9px;
  font-family: var(--body);
  font-size: 11px;
  line-height: 1.2rem;
  text-align: center;
  color: #120d08;
  background: var(--accent);
}

.ar-hub .ar-star {
  border: none;
  background: transparent;
  padding: 0 2px;
  color: var(--muted);
  flex: none;

  &.is-on {
    color: var(--accent);
  }

  &:hover {
    color: var(--accent);
  }
}

.ar-star-ico {
  color: var(--accent);
  font-size: 16px;
  text-align: center;
  line-height: 24px;
}

.ar-hub .ar-alert {
  flex: none;
  padding: 0 6px;
  border-radius: 5px;
  font-family: var(--mono);
  font-size: 11.5px;
  background: rgb(var(--c-gray-900) / 0.8);
}

.ar-fav-settings {
  margin-top: 6px;
  font-size: 13px;
  color: var(--muted);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.ar-hub .ar-threshold {
  width: 4rem;
  padding: 2px 6px;
}

/* Atziri Regex tab */
.ar-hub .ar-paste {
  flex: none;
  font-family: var(--display);
  letter-spacing: 0.04em;
  border-color: var(--accent);
  color: var(--accent);
}

.ar-regex-preview {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgb(var(--c-gray-900) / 0.85);
  font-family: var(--mono);
  font-size: 13px;

  &.is-empty {
    color: var(--muted);
    font-family: var(--body);
  }
}

.ar-regex-msg {
  flex: none;
  color: var(--accent);
  font-size: 13px;
}

.ar-regex-frame {
  width: 100%;
  border: 1px solid var(--line);
  background: #0e0a09;
}

/* Historique tab */
.ar-session {
  width: 17rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ar-session-label {
  font-family: var(--display);
  letter-spacing: 0.06em;
  font-size: 1.05rem;
  color: var(--accent);
}

.ar-kpi {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;

  div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: rgb(var(--c-gray-900) / 0.55);
  }
}

.ar-kpi-v {
  font-family: var(--mono);
  font-size: 15px;
  color: var(--fg);
}

.ar-past {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ar-past-title {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
}

.ar-past-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  font-size: 13px;
}

.ar-hub .ar-icon-btn {
  flex: none;
  padding: 3px 7px;
  font-size: 12px;
  color: var(--muted);
}

.ar-hrow {
  grid-template-columns: minmax(0, 1fr) 7.5rem 12rem 2.5rem;
}

.ar-tabfa {
  font-size: 18px;
  opacity: 0.75;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
}

/* Navigateur tab */
.ar-browser {
  flex-direction: column;
  gap: 8px;
}

.ar-browser-bar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ar-hub .ar-browser-bar button {
  padding: 6px 10px;
  font-size: 13.5px;
}

.ar-address {
  flex: 1;
  min-width: 0;
}

.ar-hub .ar-quick {
  font-family: var(--display);
  letter-spacing: 0.04em;
  color: var(--muted);
}

.ar-webview {
  flex: 1;
  min-height: 0;
  display: flex;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.ar-tabs button[aria-selected="true"] .ar-tabico {
  opacity: 1;
}

.ar-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 16px;
  padding-top: 16px;
}

/* fieldset + legend */
.ar-hub fieldset,
.ar-main {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  margin: 0;
  padding: 12px 14px;
  min-width: 0;
  /* no backdrop blur: costly without GPU acceleration */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 1px 0 rgba(0, 0, 0, 0.4);
}

.ar-hub legend {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  opacity: 0.85;
  padding: 0 4px;
}

.ar-nav {
  width: 14rem;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

/* .skinpick-like pressed buttons */
.ar-hub .ar-nav button {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  padding: 4px 10px;
  font-size: 13.5px;
}

.ar-catico {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex: none;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
}

.ar-hub .ar-nav button[aria-pressed="true"] {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.ar-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ar-main h2 {
  font-family: var(--display);
  font-weight: 400;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 1.1rem;
}

.ar-sub {
  color: rgb(var(--c-gray-300));
  font-size: 13px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.ar-search {
  font: inherit;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgb(var(--c-gray-900) / 0.85);
  color: var(--fg);
}

.ar-search:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.ar-empty {
  padding: 2rem;
  text-align: center;
  color: var(--muted);
}

.ar-table {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ar-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
}

/* rows look like .favitem cards */
.ar-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 12rem 5.5rem 7rem 5.5rem;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgb(var(--c-gray-900) / 0.55);
}

.ar-row:hover {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
}

.ar-row--head {
  border: none;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  padding-bottom: 8px;
  margin-bottom: 6px;
}

.ar-row--head:hover {
  border-color: var(--line);
}

.ar-hub .ar-sort {
  border: none;
  background: transparent;
  padding: 0;
  text-align: right;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
}

.ar-hub .ar-sort:hover {
  color: var(--accent);
}

.ar-center {
  text-align: center;
}

.ar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.ar-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  flex: none;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
}

.ar-price {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  font-family: var(--mono);
}

.ar-price-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
}

.ar-price-chaos {
  color: var(--muted);
}

.ar-cur {
  width: 20px;
  height: 20px;
}

.ar-cur-sm {
  width: 14px;
  height: 14px;
}

.ar-num {
  text-align: right;
  font-family: var(--mono);
  font-size: 13.5px;
}

.ar-muted {
  color: var(--muted);
}

.ar-ok {
  color: var(--ok);
}

.ar-bad {
  color: var(--bad);
}

.ar-spark svg {
  width: 100%;
  height: 24px;
}
</style>
