<template>
  <!-- Virtual Hideout: the header of every page of the hub -->
  <div class="vh-top">
    <button type="button" class="vh-strip" @click="go('stats')">
      {{ tr("Analyse de mes stats sur la ligue actuelle", "Analysis of my stats in the current league") }}
    </button>

    <header class="vh-head">
      <button type="button" class="vh-logo" :title="tr('Accueil', 'Home')" @click="go('home')">
        <span>Virtual</span><span>Hideout</span>
      </button>

      <nav class="vh-nav" :aria-label="tr('Navigation', 'Navigation')">
        <div class="vh-menu">
          <button
            type="button"
            class="vh-link"
            aria-haspopup="true"
            :aria-current="['ninja', 'poedb', 'craft'].includes(hubTab) ? 'page' : undefined"
            @click="go('ninja')"
          >
            PoE Ninja <i class="fas fa-chevron-down" aria-hidden="true"></i>
          </button>
          <div class="vh-drop" role="menu">
            <button type="button" role="menuitem" :aria-current="hubTab === 'ninja' ? 'page' : undefined" @click="go('ninja')">poe.ninja</button>
            <button type="button" role="menuitem" :aria-current="hubTab === 'poedb' ? 'page' : undefined" @click="go('poedb')">PoEDB</button>
            <button type="button" role="menuitem" :aria-current="hubTab === 'craft' ? 'page' : undefined" @click="go('craft')">Craft of Exile</button>
          </div>
        </div>
        <div class="vh-menu">
          <button
            type="button"
            class="vh-link"
            aria-haspopup="true"
            :aria-current="['trade', 'history'].includes(hubTab) ? 'page' : undefined"
            @click="go('trade')"
          >
            Trade <i class="fas fa-chevron-down" aria-hidden="true"></i>
          </button>
          <div class="vh-drop" role="menu">
            <button type="button" role="menuitem" :aria-current="hubTab === 'trade' ? 'page' : undefined" @click="go('trade')">
              {{ tr("Site de trade", "Trade site") }}
            </button>
            <button type="button" role="menuitem" :aria-current="hubTab === 'history' ? 'page' : undefined" @click="go('history')">
              {{ tr("Historique et rentabilité", "History and profit") }}
            </button>
          </div>
        </div>
        <button type="button" class="vh-link" :aria-current="hubTab === 'death' ? 'page' : undefined" @click="go('death')">
          Death Recap
          <span v-if="unseenDeaths" class="vh-count" :title="tr('Nouvelles morts', 'New deaths')">{{ unseenDeaths }}</span>
        </button>
        <button type="button" class="vh-link" :aria-current="hubTab === 'stats' ? 'page' : undefined" @click="go('stats')">
          Stats
        </button>
        <button type="button" class="vh-link" :aria-current="hubTab === 'market' ? 'page' : undefined" @click="go('market')">
          Price
          <span v-if="priceAlerts" class="vh-count" :title="tr('Alertes de prix', 'Price alerts')">{{ priceAlerts }}</span>
        </button>
      </nav>

      <div class="vh-tools">
        <slot />
        <button type="button" class="vh-link" @click="emit('settings')">
          <i class="fas fa-cog" aria-hidden="true"></i>{{ tr("Réglages", "Settings") }}
        </button>
      </div>
    </header>
  </div>
</template>

<script setup lang="ts">
import { tr } from "@/web/atziri-lang";
import { hubTab, type HubTab } from "./atziri-hub";
import { unseenDeaths } from "./atziri-death-recap";

defineProps<{ priceAlerts?: number }>();
const emit = defineEmits<{ (e: "settings"): void }>();

function go(tab: HubTab) {
  hubTab.value = tab;
}
</script>

<style lang="postcss">
.vh-top {
  flex: none;
  position: relative;
  z-index: 4;
}

.ar-hub .vh-top button {
  border: 0;
  border-radius: 0;
  background: none;
  color: inherit;
  padding: 0;
  font: inherit;
}

.ar-hub .vh-top button:hover {
  border-color: transparent;
}

/* announcement strip */
.ar-hub .vh-top .vh-strip {
  width: 100%;
  padding: 9px 16px;
  background: var(--sheet);
  border-bottom: 1px solid var(--rule);
  font-size: 12px;
  letter-spacing: 0.01em;
  text-align: center;
  color: var(--ink);
  transition: color 0.2s var(--ease);
}

.ar-hub .vh-top .vh-strip:hover {
  color: var(--violet);
}

/* logo, navigation, tools */
.vh-head {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 24px;
  padding: 14px var(--gutter);
  background: var(--sheet);
  border-bottom: 1px solid var(--rule);
}

.ar-hub .vh-top .vh-logo {
  justify-self: start;
  display: flex;
  flex-direction: column;
  font-size: 21px;
  font-weight: 800;
  line-height: 0.92;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  text-align: left;
  color: var(--ink);
}

.vh-nav {
  display: flex;
  align-items: center;
  gap: clamp(16px, 2.6vw, 40px);
}

.ar-hub .vh-top .vh-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink);
  background-image: linear-gradient(var(--violet), var(--violet));
  background-repeat: no-repeat;
  background-position: 0 100%;
  background-size: 0 1px;
  transition:
    background-size 0.35s var(--ease),
    color 0.2s var(--ease);
}

.ar-hub .vh-top .vh-link:hover,
.ar-hub .vh-top .vh-link[aria-current="page"] {
  color: var(--violet-deep);
  background-size: 100% 1px;
}

.vh-link .fa-chevron-down {
  font-size: 8px;
  opacity: 0.7;
}

.vh-count {
  min-width: 17px;
  height: 17px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--violet);
  color: #fff;
  font-size: 10px;
  line-height: 17px;
  text-align: center;
  letter-spacing: 0;
}

.vh-tools {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 18px;
}

.ar-hub .vh-top .vh-tools .vh-link {
  gap: 8px;
}

/* drop-down menus (hover or keyboard focus) */
.vh-menu {
  position: relative;
}

.vh-drop {
  position: absolute;
  top: calc(100% + 6px);
  left: -14px;
  min-width: 200px;
  padding: 6px;
  background: var(--sheet);
  border: 1px solid var(--rule);
  box-shadow: 0 14px 32px -12px rgba(17, 16, 20, 0.28);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition:
    opacity 0.18s var(--ease),
    transform 0.25s var(--ease),
    visibility 0s linear 0.25s;
}

.vh-menu:hover .vh-drop,
.vh-menu:focus-within .vh-drop {
  opacity: 1;
  visibility: visible;
  transform: none;
  transition-delay: 0s;
}

.ar-hub .vh-top .vh-drop button {
  display: block;
  width: 100%;
  padding: 8px 10px;
  text-align: left;
  font-size: 13px;
  color: var(--ink);
}

.ar-hub .vh-top .vh-drop button:hover,
.ar-hub .vh-top .vh-drop button[aria-current="page"] {
  background: var(--paper);
  color: var(--violet-deep);
}

/* narrow windows: the navigation wraps under the logo */
@media (max-width: 1100px) {
  .vh-head {
    grid-template-columns: 1fr auto;
  }
  .vh-nav {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-content: center;
    flex-wrap: wrap;
  }
}
</style>
