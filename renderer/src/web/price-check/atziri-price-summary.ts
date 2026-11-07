// Atziri Exchange: price summary shown at the top of the price check window
import { shallowRef } from "vue";
import { rates } from "@/web/overlay/atziri-money";

export type Confidence = "low" | "medium" | "high";

export interface TradeSummary {
  count: number; // listings found on the trade site
  cheapest: number; // Divine Orbs (after removing price fixers)
  low: number; // Divine Orbs (cheapest listings)
  high: number;
  ignored: number; // abnormally cheap listings left out ("price fixers")
  confidence: Confidence;
  sell: number; // suggested price to sell, in Divine Orbs
}

export const tradeSummary = shallowRef<TradeSummary | null>(null);

/** Value of one unit of a trade currency in Divine Orbs, if known */
function divinesPer(currency: string): number | undefined {
  const r = rates.value;
  switch (currency) {
    case "divine":
      return 1;
    case "exalted":
      return r.exalted ? 1 / r.exalted : undefined;
    case "chaos":
      return r.chaos ? 1 / r.chaos : undefined;
  }
  return undefined;
}

function median(sorted: number[]) {
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

/**
 * Leaves out "price fixers": the cheapest listings that sit far below the
 * rest (under half of the median of the following ones). Never removes more
 * than a third of the sample.
 */
function dropPriceFixers(sorted: number[]) {
  const maxDrop = Math.floor(sorted.length / 3);
  let start = 0;
  while (start < maxDrop && sorted.length - start >= 3) {
    const rest = sorted.slice(start + 1);
    if (sorted[start] < 0.5 * median(rest)) start++;
    else break;
  }
  return { kept: sorted.slice(start), ignored: start };
}

function confidenceOf(total: number, low: number, high: number): Confidence {
  let level = total < 5 ? 0 : total < 20 ? 1 : 2;
  // prices all over the place: trust it a bit less
  if (low > 0 && high / low > 3) level = Math.max(0, level - 1);
  return (["low", "medium", "high"] as const)[level];
}

/**
 * Builds the summary from the first listings (cheapest first): cheapest one,
 * and a range from the 1st to the 3rd quarter of the first 12 listings,
 * once the abnormally cheap ones are left out.
 */
export function setTradeSummary(
  total: number,
  listings: Array<{ priceAmount: number; priceCurrency: string }>,
) {
  const values = listings
    .map((l) => {
      const per = divinesPer(l.priceCurrency);
      return per != null && l.priceAmount > 0 ? l.priceAmount * per : undefined;
    })
    .filter((v): v is number => v != null)
    .slice(0, 12)
    .sort((a, b) => a - b);
  if (!values.length) {
    tradeSummary.value = null;
    return;
  }
  const { kept, ignored } = dropPriceFixers(values);
  const q = (p: number) =>
    kept[Math.min(kept.length - 1, Math.floor(p * (kept.length - 1)))];
  const low = q(0.25);
  const high = q(0.75);
  tradeSummary.value = {
    count: total,
    cheapest: kept[0],
    low,
    high,
    ignored,
    confidence: confidenceOf(total, low, high),
    // just under the cheapest serious listing, to sell quickly
    sell: kept[0] * 0.95,
  };
}

export function clearTradeSummary() {
  tradeSummary.value = null;
}
