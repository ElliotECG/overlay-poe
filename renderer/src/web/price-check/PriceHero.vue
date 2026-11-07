<template>
  <!-- Atziri Exchange: big price banner at the top of the price check -->
  <div v-if="view" class="atz-hero">
    <div class="atz-hero-cap">
      <span>{{ view.caption }}</span>
      <span
        v-if="view.confidence"
        class="atz-hero-conf"
        :class="`atz-conf-${view.confidence.level}`"
        :title="view.confidence.hint"
        ><i class="atz-hero-dot"></i>{{ view.confidence.label }}</span
      >
    </div>
    <div class="atz-hero-main">
      <span class="atz-hero-big">{{ view.main }}</span>
      <img :src="view.mainIcon" class="atz-hero-cur" />
      <span class="atz-hero-unit">{{ view.mainUnit }}</span>
    </div>
    <div v-if="view.sell" class="atz-hero-sell">
      {{ tr("À vendre ≈", "Sell at ≈") }} <b>{{ view.sell.text }}</b>
      <img :src="view.sell.icon" class="atz-hero-cur-sm" />
      {{ view.sell.unit }}
    </div>
    <div v-if="view.sub" class="atz-hero-sub">{{ view.sub }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ParsedItem } from "@/parser";
import { usePoeninja, displayRounding } from "@/web/background/Prices";
import { getDetailsId } from "./trends/getDetailsId";
import { tradeSummary } from "./atziri-price-summary";
import { rates, CURRENCY_ICONS } from "@/web/overlay/atziri-money";
import { tr } from "@/web/atziri-lang";

const props = defineProps<{ item: ParsedItem; tradeSearch: boolean }>();
const ninja = usePoeninja();

/** Shows a Divine amount in Divines (≥ 1), Chaos, or Exalted (< 1 Chaos) */
function inBestUnit(div: number) {
  const { chaos, exalted } = rates.value;
  if (div >= 1 || !chaos) {
    return { text: displayRounding(div, false, true), icon: CURRENCY_ICONS.div, unit: "Divines" };
  }
  if (div * chaos >= 1 || !exalted) {
    return { text: displayRounding(div * chaos, false, true), icon: CURRENCY_ICONS.chaos, unit: "Chaos" };
  }
  return { text: displayRounding(div * exalted, true, true), icon: CURRENCY_ICONS.exalted, unit: tr("Exaltés", "Exalted") };
}

function confidenceView(level: "low" | "medium" | "high") {
  switch (level) {
    case "low":
      return { level, label: tr("Fiabilité faible", "Low confidence"), hint: tr("Moins de 5 annonces ou prix très dispersés", "Under 5 listings or prices all over the place") };
    case "medium":
      return { level, label: tr("Fiabilité moyenne", "Medium confidence"), hint: tr("Entre 5 et 20 annonces", "Between 5 and 20 listings") };
    default:
      return { level, label: tr("Fiabilité bonne", "Good confidence"), hint: tr("Plus de 20 annonces aux prix cohérents", "Over 20 listings with consistent prices") };
  }
}

function chaosText(div: number) {
  const { chaos } = rates.value;
  return chaos ? `≈ ${displayRounding(div * chaos, true, true)} Chaos` : "";
}

const view = computed(() => {
  // 1) trade search results: range of the cheapest listings
  const s = tradeSummary.value;
  if (props.tradeSearch && s) {
    const low = inBestUnit(s.low);
    const high = inBestUnit(s.high);
    const same = low.unit === high.unit;
    const cheapest = inBestUnit(s.cheapest);
    const pl = (n: number) => (n > 1 ? "s" : "");
    const ignored =
      s.ignored > 0
        ? tr(
            ` · ${s.ignored} annonce${pl(s.ignored)} trop basse${pl(s.ignored)} ignorée${pl(s.ignored)}`,
            ` · ${s.ignored} too cheap listing${pl(s.ignored)} ignored`,
          )
        : "";
    return {
      caption: tr(
        `Prix estimé · ${s.count} annonce${pl(s.count)} · trade`,
        `Estimated price · ${s.count} listing${pl(s.count)} · trade`,
      ),
      confidence: confidenceView(s.confidence),
      main: same && low.text !== high.text ? `${low.text} – ${high.text}` : low.text,
      mainIcon: low.icon,
      mainUnit: low.unit,
      sell: inBestUnit(s.sell),
      sub: `${tr("le moins cher", "cheapest")} ${cheapest.text} ${cheapest.unit} · ${chaosText(s.low)}${ignored}`,
    };
  }
  // 2) poe.ninja price (currency, uniques, gems...)
  try {
    const q = getDetailsId(props.item);
    const p = q ? ninja.findPriceByQuery(q) : null;
    if (p) {
      const count = props.item.stackSize?.value ?? 1;
      const one = inBestUnit(p.primaryValue);
      const all = inBestUnit(p.primaryValue * count);
      return {
        caption: tr("Prix poe.ninja", "poe.ninja price"),
        main: all.text,
        mainIcon: all.icon,
        mainUnit: all.unit + (count > 1 ? ` (×${count})` : ""),
        sub: count > 1 ? `1 = ${one.text} ${one.unit} · ${chaosText(p.primaryValue)}` : chaosText(p.primaryValue),
      };
    }
  } catch {
    // no poe.ninja price for this item
  }
  return null;
});
</script>

<style lang="postcss">
.atz-hero {
  margin: 0 0 8px;
  padding: 8px 12px;
  border: 1px solid theme("colors.blue.400");
  border-radius: 8px;
  background: linear-gradient(
    180deg,
    rgb(var(--c-blue-900) / 0.95),
    rgb(var(--c-gray-900) / 0.95)
  );
  box-shadow: 0 0 18px rgb(var(--c-blue-400) / 0.15);
}

.atz-hero-conf {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  letter-spacing: 0.04em;
}

.atz-hero-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.atz-conf-low {
  color: #e05a4f;
}

.atz-conf-medium {
  color: #e0a84f;
}

.atz-conf-high {
  color: #6fc46a;
}

.atz-hero-sell {
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.85rem;
  color: theme("colors.gray.300");
}

.atz-hero-sell b {
  font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace;
  color: theme("colors.blue.400");
}

.atz-hero-cur-sm {
  width: 1.1rem;
  height: 1.1rem;
}

.atz-hero-cap {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: theme("colors.gray.400");
}

.atz-hero-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.atz-hero-big {
  font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace;
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.1;
  color: theme("colors.gray.100");
}

.atz-hero-cur {
  width: 1.6rem;
  height: 1.6rem;
}

.atz-hero-unit {
  color: theme("colors.gray.400");
}

.atz-hero-sub {
  font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace;
  font-size: 0.75rem;
  color: theme("colors.gray.400");
}
</style>
