// Atziri Exchange: favorite items of the Economy tab and their price alerts
import { shallowRef, watch } from "vue";

export interface Favorite {
  type: string; // poe.ninja category type (Currency, Essences...)
  ns: string;
  name: string; // English reference name
  variant?: string;
  refPrice: number; // Divine Orbs when starred, base of the alert
  addedAt: number;
}

const FAV_KEY = "atziri-favorites";
const THRESHOLD_KEY = "atziri-favorites-threshold";

function load<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore unavailable storage
  }
}

export const favorites = shallowRef<Favorite[]>(load(FAV_KEY, []));
/** Alert when the price moved by at least this many percent since starred */
export const alertThreshold = shallowRef<number>(load(THRESHOLD_KEY, 10));

watch(favorites, (v) => save(FAV_KEY, v));
watch(alertThreshold, (v) => save(THRESHOLD_KEY, v));

export function favKey(f: { type: string; name: string; variant?: string }) {
  return `${f.type}|${f.name}|${f.variant ?? ""}`;
}

export function isFavorite(type: string, name: string, variant?: string) {
  const key = favKey({ type, name, variant });
  return favorites.value.some((f) => favKey(f) === key);
}

export function toggleFavorite(fav: Omit<Favorite, "addedAt">) {
  const key = favKey(fav);
  if (favorites.value.some((f) => favKey(f) === key)) {
    favorites.value = favorites.value.filter((f) => favKey(f) !== key);
  } else {
    favorites.value = [...favorites.value, { ...fav, addedAt: Date.now() }];
  }
}

/** Resets the alert base of a favorite to its current price */
export function acknowledgeAlert(key: string, price: number) {
  favorites.value = favorites.value.map((f) =>
    favKey(f) === key ? { ...f, refPrice: price } : f,
  );
}

/** % change since starred */
export function changeSince(fav: Favorite, price: number | undefined) {
  if (price == null || !fav.refPrice) return 0;
  return ((price - fav.refPrice) / fav.refPrice) * 100;
}
