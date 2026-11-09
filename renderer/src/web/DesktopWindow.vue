<template>
  <!-- My Ritualist Overlay: the hub in a normal window (main/src/windowing/DesktopWindow.ts) -->
  <div id="desktop-window" class="overflow-hidden relative w-full h-full">
    <div class="atziri-frame atz-desktop-frame"></div>
    <MarketPrices v-show="!settingsOpen" :visible="!settingsOpen" />
    <component
      :is="registry.getWidgetComponent('settings')"
      v-if="settingsWidget"
      v-show="settingsOpen"
      :config="settingsWidget"
    />
    <PobCompareCard />
  </div>
</template>

<script setup lang="ts">
// Only the hub, its settings and the "Compare in PoB" card. No game
// logic here (death clips, character followed, shortcuts): the overlay
// page does it, once.
import { computed, provide, reactive, readonly, shallowRef } from "vue";
import { AppConfig } from "@/web/Config";
import { usePoeninja } from "@/web/background/Prices";
import { useLeagues } from "@/web/background/Leagues";
import type { Widget, WidgetManager } from "./overlay/interfaces";
import { registry } from "./overlay/widget-registry.js";
import MarketPrices from "./overlay/MarketPrices.vue";
import PobCompareCard from "./overlay/PobCompareCard.vue";

usePoeninja();
useLeagues().load();

// The settings page of this window: its own copy of the settings widget, so
// opening it here never opens it in the overlay (widgets are saved in the
// shared configuration)
const source = AppConfig().widgets.find((w) => w.wmType === "settings");
const settingsWidget = source
  ? reactive<Widget>({ ...(JSON.parse(JSON.stringify(source)) as Widget), wmWants: "hide" })
  : null;
const settingsOpen = computed(() => settingsWidget?.wmWants === "show");

function isSettings(wmId: number) {
  return settingsWidget != null && wmId === settingsWidget.wmId;
}

const size = shallowRef({ width: window.innerWidth, height: window.innerHeight });
window.addEventListener("resize", () => {
  size.value = { width: window.innerWidth, height: window.innerHeight };
});

provide<WidgetManager>("wm", {
  poePanelWidth: computed(() => 0),
  size: readonly(size),
  active: shallowRef(true),
  widgets: computed(() => AppConfig().widgets),
  show(wmId) {
    if (isSettings(wmId)) settingsWidget!.wmWants = "show";
  },
  hide(wmId) {
    if (isSettings(wmId)) settingsWidget!.wmWants = "hide";
  },
  remove() {},
  bringToTop() {},
  create() {},
  setFlag(wmId, flag, state) {
    if (!isSettings(wmId)) return;
    const flags = settingsWidget!.wmFlags;
    const has = flags.includes(flag as Widget["wmFlags"][number]);
    if (state && !has) flags.push(flag as Widget["wmFlags"][number]);
    if (!state && has) settingsWidget!.wmFlags = flags.filter((f) => f !== flag);
  },
});
</script>

<style lang="postcss">
/* the hub and the settings fill the window (no margins around the game) */
#desktop-window {
  --atz-x: 0px;
  --atz-y: 0px;
  background: rgb(var(--c-gray-900));
}

#desktop-window .atz-desktop-frame {
  border: none;
  border-radius: 0;
  box-shadow: none;
  animation: none;
}
</style>
