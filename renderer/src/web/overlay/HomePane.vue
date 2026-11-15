<template>
  <!-- My Ritualist Overlay: home page of the hub (editorial, light) -->
  <section class="vh-home" :class="{ 'is-entering': entering }" aria-label="Virtual Hideout">
    <button type="button" class="vh-strip" @click="go('stats')">
      {{ tr("Analyse de mes stats sur la ligue actuelle", "Analysis of my stats in the current league") }}
    </button>

    <header class="vh-head">
      <button type="button" class="vh-logo" :title="tr('Accueil', 'Home')" @click="go('home')">
        <span>Virtual</span><span>Hideout</span>
      </button>

      <nav class="vh-nav" :aria-label="tr('Navigation', 'Navigation')">
        <div class="vh-menu">
          <button type="button" class="vh-link" aria-haspopup="true" @click="go('ninja')">
            PoE Ninja <i class="fas fa-chevron-down" aria-hidden="true"></i>
          </button>
          <div class="vh-drop" role="menu">
            <button type="button" role="menuitem" @click="go('ninja')">poe.ninja</button>
            <button type="button" role="menuitem" @click="go('poedb')">PoEDB</button>
            <button type="button" role="menuitem" @click="go('craft')">Craft of Exile</button>
          </div>
        </div>
        <div class="vh-menu">
          <button type="button" class="vh-link" aria-haspopup="true" @click="go('trade')">
            Trade <i class="fas fa-chevron-down" aria-hidden="true"></i>
          </button>
          <div class="vh-drop" role="menu">
            <button type="button" role="menuitem" @click="go('trade')">
              {{ tr("Site de trade", "Trade site") }}
            </button>
            <button type="button" role="menuitem" @click="go('history')">
              {{ tr("Historique et rentabilité", "History and profit") }}
            </button>
          </div>
        </div>
        <button type="button" class="vh-link" @click="go('death')">
          Death Recap
          <span v-if="unseenDeaths" class="vh-count">{{ unseenDeaths }}</span>
        </button>
        <button type="button" class="vh-link" @click="go('stats')">Stats</button>
        <button type="button" class="vh-link" @click="go('market')">Price</button>
      </nav>

      <button type="button" class="vh-link vh-settings" @click="emit('settings')">
        <i class="fas fa-cog" aria-hidden="true"></i>{{ tr("Réglages", "Settings") }}
      </button>
    </header>

    <div class="vh-hero">
      <img class="vh-photo" src="/images/ritualist-hero.jpg" alt="" draggable="false" />

      <h1 class="vh-title vh-title-top">
        <span class="vh-line"><span>My</span></span>
        <span class="vh-line is-soft"><span>ritualiste</span></span>
      </h1>

      <p class="vh-quote">
        La Corruption vous a coûté<br />
        votre foyer, mais vous a<br />
        appris tellement plus...
      </p>

      <div class="vh-league">
        <p class="vh-title vh-title-bottom" aria-hidden="true">
          <span class="vh-line"><span>current</span></span>
          <span class="vh-line is-soft"><span>ligue</span></span>
        </p>
        <label class="vh-league-pick">
          <span class="sr-only">{{ tr("Ligue actuelle", "Current league") }}</span>
          <select :value="leagues.selectedId.value" @change="setLeague(($event.target as HTMLSelectElement).value)">
            <option
              v-if="leagueName && !leagues.list.value.some((l) => l.id === leagueName)"
              :value="leagueName"
            >
              {{ leagueName }}
            </option>
            <option v-for="l in leagues.list.value" :key="l.id" :value="l.id">{{ l.text }}</option>
          </select>
          <i class="fas fa-chevron-down" aria-hidden="true"></i>
        </label>
      </div>

      <div class="vh-cta">
        <button type="button" class="vh-cta-btn" @click="go('stats')">
          <span class="vh-cta-tab" aria-hidden="true"></span>
          <span class="vh-cta-label">View the Build</span>
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
        </button>
        <span v-if="character" class="vh-cta-note">{{ character }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue";
import { tr } from "@/web/atziri-lang";
import { saveConfig } from "@/web/Config";
import { useLeagues } from "@/web/background/Leagues";
import { hubTab, type HubTab } from "./atziri-hub";
import { unseenDeaths } from "./atziri-death-recap";

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: "settings"): void }>();

const leagues = useLeagues();
const leagueName = computed(() => leagues.selectedId.value ?? "");

function setLeague(id: string) {
  if (!id || id === leagues.selectedId.value) return;
  leagues.selectedId.value = id;
  saveConfig();
}

function go(tab: HubTab) {
  hubTab.value = tab;
}

// "Ritualist · niv. 90": the build compared with (Path of Building)
const character = shallowRef("");
async function loadCharacter() {
  try {
    const s = await (await fetch("/atziri-pob/status")).json();
    const b = s?.build;
    const parts = [b?.className, b?.level ? tr(`niv. ${b.level}`, `lvl ${b.level}`) : ""];
    character.value = parts.filter(Boolean).join(" · ");
  } catch {
    // dev mode: no main-process routes
  }
}

// the page settles in once each time the hub opens on it
const entering = shallowRef(true);
let enterTimer: ReturnType<typeof setTimeout> | undefined;
function enter() {
  entering.value = true;
  clearTimeout(enterTimer);
  // a timer (not requestAnimationFrame): it also runs while the window is in the background
  enterTimer = setTimeout(() => { entering.value = false; }, 40);
}
onMounted(() => {
  enter();
  loadCharacter();
});
watch(
  () => props.visible,
  (v) => {
    if (!v) return;
    enter();
    loadCharacter();
  },
);
</script>

<style lang="postcss">
/* Virtual Hideout: an editorial page in the overlay. Paper white, ink black,
   graphite for the second word, and the ritual violet of the smoke. */
.vh-home {
  --paper: #f4f3f6;
  --sheet: #ffffff;
  --ink: #111014;
  --graphite: #7a7884;
  --rule: #e2e0e7;
  --violet: #6b3fd1;
  --violet-deep: #4a2a99;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);

  position: absolute;
  /* fills the whole frame of the hub, edge to edge */
  inset: -0.75rem -1.5rem -1.25rem -1.5rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0.75rem;
  background: var(--paper);
  color: var(--ink);
  font-family: "Inter", "Segoe UI", system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  z-index: 2;
}

.vh-home ::selection {
  background: var(--violet);
  color: #fff;
}

.vh-home :focus-visible {
  outline: 2px solid var(--violet);
  outline-offset: 3px;
}

/* every control of the page starts bare (the hub styles its own buttons) */
.ar-hub .vh-home button {
  border: 0;
  border-radius: 0;
  background: none;
  color: inherit;
  padding: 0;
  font: inherit;
}

.ar-hub .vh-home button:hover {
  border-color: transparent;
}

/* announcement strip */
.ar-hub .vh-home .vh-strip {
  flex: none;
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

.ar-hub .vh-home .vh-strip:hover {
  color: var(--violet);
}

/* header: logo, navigation, settings */
.vh-head {
  flex: none;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 24px;
  padding: 14px clamp(20px, 4.5vw, 64px);
  background: var(--sheet);
}

.ar-hub .vh-home .vh-logo {
  justify-self: start;
  display: flex;
  flex-direction: column;
  font-size: 21px;
  font-weight: 800;
  line-height: 0.92;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  text-align: left;
}

.vh-nav {
  display: flex;
  align-items: center;
  gap: clamp(16px, 2.6vw, 40px);
}

.ar-hub .vh-home .vh-link {
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

.ar-hub .vh-home .vh-link:hover {
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

.ar-hub .vh-home .vh-settings {
  justify-self: end;
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
  min-width: 190px;
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
  z-index: 5;
}

.vh-menu:hover .vh-drop,
.vh-menu:focus-within .vh-drop {
  opacity: 1;
  visibility: visible;
  transform: none;
  transition-delay: 0s;
}

.ar-hub .vh-home .vh-drop button {
  display: block;
  width: 100%;
  padding: 8px 10px;
  text-align: left;
  font-size: 13px;
  color: var(--ink);
}

.ar-hub .vh-home .vh-drop button:hover {
  background: var(--paper);
  color: var(--violet-deep);
}

/* hero: the photograph, the two titles, the quote, the call to action */
.vh-hero {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #e9e8ee;
}

.vh-photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 58% 38%;
  user-select: none;
  transition:
    transform 1.6s var(--ease),
    filter 1.2s var(--ease);
}

.vh-title {
  position: absolute;
  margin: 0;
  display: flex;
  flex-direction: column;
  font-size: clamp(3rem, 6.2vw, 6rem);
  font-weight: 500;
  line-height: 0.96;
  letter-spacing: -0.04em;
  color: var(--ink);
}

.vh-line {
  display: block;
  overflow: hidden;
  padding-bottom: 0.06em;
}

.vh-line > span {
  display: block;
  transition: transform 1.1s var(--ease);
}

.vh-line.is-soft {
  color: var(--graphite);
}

.vh-title-top {
  top: clamp(20px, 6%, 56px);
  left: clamp(20px, 4.5vw, 64px);
}

.vh-title-bottom {
  position: static;
  align-items: flex-end;
  text-align: right;
}

.vh-quote {
  position: absolute;
  right: clamp(20px, 4.5vw, 64px);
  top: 46%;
  margin: 0;
  max-width: 24ch;
  font-size: 13px;
  line-height: 1.6;
  text-align: right;
  color: var(--ink);
  transition: opacity 1s var(--ease) 0.25s;
}

.vh-league {
  position: absolute;
  right: clamp(20px, 4.5vw, 64px);
  bottom: clamp(18px, 6%, 52px);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.vh-league-pick {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-top: 10px;
  color: var(--ink);
}

.vh-league-pick select {
  appearance: none;
  border: 0;
  border-bottom: 1px solid var(--ink);
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: 500 12px/1.4 "Inter", "Segoe UI", system-ui, sans-serif;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 4px 20px 4px 0;
  cursor: pointer;
}

.vh-league-pick select:hover {
  color: var(--violet-deep);
  border-color: var(--violet);
}

.vh-league-pick select option {
  background: var(--sheet);
  color: var(--ink);
  text-transform: none;
}

.vh-league-pick .fa-chevron-down {
  position: absolute;
  right: 2px;
  font-size: 8px;
  pointer-events: none;
}

.vh-cta {
  position: absolute;
  left: clamp(20px, 4.5vw, 64px);
  bottom: clamp(18px, 6%, 52px);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.ar-hub .vh-home .vh-cta-btn {
  display: inline-flex;
  align-items: stretch;
  gap: 0;
  background: var(--ink);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  box-shadow: 0 10px 24px -14px rgba(17, 16, 20, 0.6);
  transition:
    background-color 0.25s var(--ease),
    box-shadow 0.25s var(--ease);
}

.ar-hub .vh-home .vh-cta-btn:hover {
  background: var(--violet-deep);
  box-shadow: 0 14px 28px -14px rgba(74, 42, 153, 0.7);
}

.vh-cta-tab {
  width: 6px;
  margin-right: 10px;
  background: var(--paper);
  border-right: 1px solid var(--ink);
}

.vh-cta-label {
  padding: 13px 4px 13px 6px;
}

.vh-cta-btn .fa-arrow-right {
  align-self: center;
  padding: 0 16px 0 14px;
  transition: transform 0.3s var(--ease);
}

.vh-cta-btn:hover .fa-arrow-right {
  transform: translateX(4px);
}

.vh-cta-note {
  font-size: 12px;
  letter-spacing: 0.02em;
  color: var(--ink);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* the one moment: the photograph comes into focus while the titles rise */
.vh-home.is-entering .vh-photo {
  transform: scale(1.045);
  filter: blur(6px);
  transition: none;
}

.vh-home.is-entering .vh-line > span {
  transform: translateY(105%);
  transition: none;
}

.vh-home.is-entering .vh-quote {
  opacity: 0;
  transition: none;
}

.vh-title-top .vh-line.is-soft > span,
.vh-title-bottom .vh-line.is-soft > span {
  transition-delay: 0.08s;
}

.vh-title-bottom .vh-line > span {
  transition-delay: 0.14s;
}

@media (prefers-reduced-motion: reduce) {
  .vh-photo,
  .vh-line > span,
  .vh-quote {
    transition: none !important;
  }
  .vh-home.is-entering .vh-photo {
    transform: none;
    filter: none;
  }
  .vh-home.is-entering .vh-line > span {
    transform: none;
  }
  .vh-home.is-entering .vh-quote {
    opacity: 1;
  }
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
  .vh-quote {
    display: none;
  }
}
</style>
