<template>
  <!-- Atziri Exchange: farming sessions and history of price checks -->
  <div class="ar-body">
    <fieldset class="ar-nav ar-session">
      <legend>{{ tr("Rentabilité", "Profit") }}</legend>
      <template v-if="active">
        <div class="ar-session-label">{{ active.label }}</div>
        <div class="ar-sub">{{ tr("Depuis", "For") }} {{ duration(active) }}</div>
        <div class="ar-kpi">
          <div>
            <span class="ar-kpi-v">{{ money(sessionTotal(active)) }}</span>
            <span class="ar-sub">{{ tr("total estimé", "estimated total") }}</span>
          </div>
          <div>
            <span class="ar-kpi-v">{{ money(perHour(active)) }}</span>
            <span class="ar-sub">{{ tr("par heure", "per hour") }}</span>
          </div>
          <div>
            <span class="ar-kpi-v">{{ sessionItems(active).length }}</span>
            <span class="ar-sub">{{ tr("objets vérifiés", "items checked") }}</span>
          </div>
        </div>
        <button type="button" @click="stopSession">
          <i class="fas fa-stop"></i> {{ tr("Arrêter la session", "Stop the session") }}
        </button>
      </template>
      <template v-else>
        <div class="ar-sub">
          {{ tr("Lance une session : chaque objet vérifié avec Ctrl+D s'ajoute au total.", "Start a session: every item checked with Ctrl+D is added to the total.") }}
        </div>
        <input
          v-model="newLabel"
          type="text"
          class="ar-search"
          :placeholder="tr('Nom (ex. Brèche, Abysse…)', 'Name (e.g. Breach, Abyss…)')"
          @keydown.enter="start"
        />
        <button type="button" @click="start">
          <i class="fas fa-play"></i> {{ tr("Démarrer une session", "Start a session") }}
        </button>
      </template>

      <div v-if="pastSessions.length" class="ar-past">
        <div class="ar-sub ar-past-title">{{ tr("Sessions précédentes", "Previous sessions") }}</div>
        <div v-for="s in pastSessions" :key="s.id" class="ar-past-row">
          <div class="flex-1 min-w-0">
            <div class="truncate">{{ s.label }}</div>
            <div class="ar-sub">
              {{ dayTime(s.start) }} · {{ duration(s) }}
            </div>
          </div>
          <div class="text-right">
            <div class="ar-num">{{ money(sessionTotal(s)) }}</div>
            <div class="ar-sub">{{ money(perHour(s)) }} / h</div>
          </div>
          <button
            type="button"
            class="ar-icon-btn"
            :title="tr('Supprimer', 'Delete')"
            @click="deleteSession(s.id)"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </fieldset>

    <section class="ar-main">
      <div class="ar-main-head flex items-end justify-between gap-3">
        <div>
          <h2>{{ tr("Historique des vérifications", "Price check history") }}</h2>
          <div class="ar-sub">
            {{ history.length }} {{ tr("objets · total estimé", "items · estimated total") }} {{ money(total) }}
          </div>
        </div>
        <button
          v-if="history.length"
          type="button"
          class="ar-sort"
          @click="clearHistory"
        >
          {{ tr("Effacer", "Clear") }}
        </button>
      </div>
      <div v-if="!history.length" class="ar-empty">
        {{ tr("Fais Ctrl+D sur un objet en jeu : il apparaîtra ici.", "Press Ctrl+D on an item in game: it will show up here.") }}
      </div>
      <div v-else class="ar-list">
        <div v-for="e in history" :key="e.id" class="ar-row ar-hrow">
          <div class="ar-item">
            <img v-if="e.icon" :src="e.icon" class="ar-icon" />
            <span class="truncate">
              {{ e.count > 1 ? `${e.count} × ` : "" }}{{ e.name }}
            </span>
          </div>
          <div class="ar-sub">{{ dayTime(e.at) }}</div>
          <div class="ar-price">
            <template v-if="value(e) != null">
              <div class="ar-price-cell">
                <template v-if="fmtOf(e).divText">
                  {{ fmtOf(e).divText }}
                  <img src="/images/divine.png" class="ar-cur" />
                </template>
              </div>
              <div class="ar-price-cell ar-price-chaos">
                {{ fmtOf(e).chaosText }}
                <img :src="fmtOf(e).chaosIcon" class="ar-cur" />
              </div>
            </template>
            <div v-else class="ar-sub ar-center" style="grid-column: span 2">
              {{ tr("Prix via le trade", "Price from trade") }}
            </div>
          </div>
          <button type="button" class="ar-icon-btn" :title="tr('Revérifier le prix', 'Check the price again')" @click="recheck(e)">
            <i class="fas fa-redo"></i>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, onMounted, onUnmounted } from "vue";
import { usePoeninja } from "@/web/background/Prices";
import {
  history,
  sessions,
  startSession,
  stopSession,
  deleteSession,
  clearHistory,
  recheck,
  type HistoryEntry,
  type FarmSession,
} from "./atziri-history";
import { formatDivines } from "./atziri-money";
import { tr, dateLocale } from "@/web/atziri-lang";

const ninja = usePoeninja();
const newLabel = shallowRef("");

// refresh durations every 30 s
const now = shallowRef(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  ninja.queuePricesFetch();
  timer = setInterval(() => (now.value = Date.now()), 30000);
});
onUnmounted(() => clearInterval(timer));

const active = computed(() => sessions.value.find((s) => s.end == null));
const pastSessions = computed(() =>
  sessions.value.filter((s) => s.end != null).slice(0, 8),
);

function start() {
  startSession(newLabel.value);
  newLabel.value = "";
}

/**
 * Estimated value in Divine Orbs (poe.ninja) of every entry, computed once per
 * change instead of on every render (price lookups search a large text).
 */
const values = computed(() => {
  const map = new Map<number, number | undefined>();
  // recompute when prices are refreshed
  if (ninja.marketUpdatedAt.value == null && !history.value.length) return map;
  for (const e of history.value) {
    const p = e.query ? ninja.findPriceByQuery(e.query) : null;
    map.set(e.id, p ? p.primaryValue * e.count : undefined);
  }
  return map;
});

function value(e: HistoryEntry): number | undefined {
  return values.value.get(e.id);
}

const formatted = computed(() => {
  const map = new Map<number, ReturnType<typeof formatDivines>>();
  for (const [id, v] of values.value) {
    if (v != null) map.set(id, formatDivines(v));
  }
  return map;
});

function fmtOf(e: HistoryEntry) {
  return formatted.value.get(e.id)!;
}

function money(div: number) {
  const f = formatDivines(div);
  return f.divText ? `${f.divText} div` : `${f.chaosText} ${f.chaosIcon.includes("exa") ? "ex" : "c"}`;
}

const total = computed(() =>
  history.value.reduce((sum, e) => sum + (value(e) ?? 0), 0),
);

function sessionItems(s: FarmSession) {
  return history.value.filter((e) => e.sessionId === s.id);
}
function sessionTotal(s: FarmSession) {
  return sessionItems(s).reduce((sum, e) => sum + (value(e) ?? 0), 0);
}
function hours(s: FarmSession) {
  return Math.max(((s.end ?? now.value) - s.start) / 3600000, 1 / 60);
}
function perHour(s: FarmSession) {
  return sessionTotal(s) / hours(s);
}
function duration(s: FarmSession) {
  const min = Math.round(((s.end ?? now.value) - s.start) / 60000);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}
function dayTime(t: number) {
  return new Date(t).toLocaleString(dateLocale(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>
