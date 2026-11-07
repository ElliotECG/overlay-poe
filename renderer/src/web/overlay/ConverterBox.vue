<template>
  <!-- Atziri Exchange: Divine / Chaos / Exalted converter at poe.ninja rates -->
  <div class="ar-converter" :title="tr('Convertisseur au taux poe.ninja du moment', 'Converter at the current poe.ninja rate')">
    <input
      v-model.number="amount"
      type="number"
      min="0"
      step="any"
      class="ar-search ar-conv-input"
    />
    <div class="ar-conv-from">
      <button
        v-for="c in CURRENCIES"
        :key="c.id"
        type="button"
        :aria-pressed="from === c.id"
        :title="tr(c.label, c.labelEn)"
        @click="from = c.id"
      >
        <img :src="c.icon" alt="" />
      </button>
    </div>
    <span class="ar-conv-eq">=</span>
    <div class="ar-conv-out">
      <template v-for="c in CURRENCIES" :key="c.id">
        <span v-if="c.id !== from" class="ar-conv-val">
          {{ converted(c.id) }}
          <img :src="c.icon" alt="" />
        </span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { shallowRef } from "vue";
import { displayRounding } from "@/web/background/Prices";
import { rates, CURRENCY_ICONS } from "./atziri-money";
import { tr } from "@/web/atziri-lang";

type Cur = "div" | "chaos" | "exalted";
const CURRENCIES: Array<{ id: Cur; label: string; labelEn: string; icon: string }> = [
  { id: "div", label: "Orbe divin", labelEn: "Divine Orb", icon: CURRENCY_ICONS.div },
  { id: "chaos", label: "Orbe du chaos", labelEn: "Chaos Orb", icon: CURRENCY_ICONS.chaos },
  { id: "exalted", label: "Orbe exalté", labelEn: "Exalted Orb", icon: CURRENCY_ICONS.exalted },
];

const amount = shallowRef(1);
const from = shallowRef<Cur>("div");

/** Value of one unit in Divine Orbs */
function perDivine(c: Cur): number | undefined {
  if (c === "div") return 1;
  return c === "chaos" ? rates.value.chaos : rates.value.exalted;
}

function converted(to: Cur): string {
  const fromRate = perDivine(from.value);
  const toRate = perDivine(to);
  if (!fromRate || !toRate || !Number.isFinite(amount.value)) return "—";
  const divines = amount.value / fromRate;
  return displayRounding(divines * toRate, true, true);
}
</script>
