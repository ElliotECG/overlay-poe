<template>
  <!-- My Ritualist Overlay: home page of the hub (editorial, light) -->
  <section class="vh-home" :class="{ 'is-entering': entering }" aria-label="Virtual Hideout">
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
/* Virtual Hideout home: the photograph fills the page under the header */
.vh-home {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: var(--ink);
  font-size: 13px;
  line-height: 1.45;
}

.ar-hub .vh-home button {
  border: 0;
  border-radius: 0;
  background: none;
  color: inherit;
  padding: 0;
  font: inherit;
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
  /* never animated: the overlay draws without the graphics card, and
     moving or blurring a full-page photograph jerks */
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
  transition: transform 0.7s var(--ease);
}

.vh-line.is-soft {
  color: var(--graphite);
}

.vh-title-top {
  top: clamp(20px, 6%, 56px);
  left: var(--gutter);
}

.vh-title-bottom {
  position: static;
  align-items: flex-end;
  text-align: right;
}

.vh-quote {
  position: absolute;
  right: var(--gutter);
  top: 46%;
  margin: 0;
  max-width: 24ch;
  font-size: 13px;
  line-height: 1.6;
  text-align: right;
  color: var(--ink);
  transition: opacity 0.5s var(--ease) 0.2s;
}

.vh-league {
  position: absolute;
  right: var(--gutter);
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
  left: var(--gutter);
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

/* the one moment: the titles rise out of their lines, the quote follows */
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
  transition-delay: 0.06s;
}

.vh-title-bottom .vh-line > span {
  transition-delay: 0.1s;
}

@media (prefers-reduced-motion: reduce) {
  .vh-line > span,
  .vh-quote {
    transition: none !important;
  }
  .vh-home.is-entering .vh-line > span {
    transform: none;
  }
  .vh-home.is-entering .vh-quote {
    opacity: 1;
  }
}

/* narrow windows: the quote steps aside */
@media (max-width: 1100px) {
  .vh-quote {
    display: none;
  }
}
</style>
