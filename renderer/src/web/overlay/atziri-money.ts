// Atziri Exchange: exchange rates (from poe.ninja live data) and price formatting
import { shallowRef } from "vue";
import { displayRounding } from "@/web/background/Prices";

export const CURRENCY_ICONS = {
  exalted: "/images/exa.png",
  chaos: "/images/chaos.png",
  div: "/images/divine.png",
} as const;

/** Chaos and Exalted Orbs per Divine Orb, updated by the Economy tab */
export const rates = shallowRef<{ chaos?: number; exalted?: number }>({});

export function setRates(chaos?: number, exalted?: number) {
  if (!chaos && !exalted) return;
  rates.value = {
    chaos: chaos ?? rates.value.chaos,
    exalted: exalted ?? rates.value.exalted,
  };
}

/**
 * Divine Orbs (only when worth at least 1), and Chaos Orbs or, under 1 Chaos,
 * Exalted Orbs.
 */
export function formatDivines(divines: number) {
  const { chaos: chaosRate, exalted: exaRate } = rates.value;
  const divText = divines >= 1 ? displayRounding(divines, false, true) : "";
  const chaos = chaosRate ? divines * chaosRate : undefined;
  if (chaos != null && chaos < 1 && exaRate) {
    return {
      divText,
      chaosText: displayRounding(divines * exaRate, true, true),
      chaosIcon: CURRENCY_ICONS.exalted as string,
    };
  }
  return {
    divText,
    chaosText: chaos != null ? displayRounding(chaos, true, true) : "—",
    chaosIcon: CURRENCY_ICONS.chaos as string,
  };
}
