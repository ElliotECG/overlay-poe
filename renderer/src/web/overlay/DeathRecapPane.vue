<template>
  <!-- Atziri Exchange: video of the last seconds before each death (NVIDIA Instant Replay) -->
  <div class="ar-body">
    <fieldset class="ar-nav ar-session">
      <legend>Death Recap</legend>

      <div class="ar-dr-status" :class="recapEnabled ? 'is-recording' : 'is-off'">
        <span class="ar-dr-dot"></span>
        <span>{{ recapEnabled ? tr("Actif", "On") : tr("Désactivé", "Off") }}</span>
      </div>
      <div class="ar-sub">
        {{ tr("Enregistré par NVIDIA Instant Replay", "Recorded by NVIDIA Instant Replay") }}
        <template v-if="nvidia">· {{ nvidia.shortcut }}</template>
      </div>
      <div v-if="tooLong" class="ar-sub ar-dr-warn">
        <i class="fas fa-exclamation-triangle"></i>
        {{
          tr(
            `Durée du replay : ${replayText}. Mets 30 s dans l'appli NVIDIA (Alt+Z > Instant Replay > Paramètres) pour des vidéos légères.`,
            `Replay length: ${replayText}. Set it to 30 s in the NVIDIA app (Alt+Z > Instant Replay > Settings) for small videos.`,
          )
        }}
      </div>
      <div v-if="recapError" class="ar-sub ar-dr-warn">
        <i class="fas fa-exclamation-triangle"></i>
        {{
          recapError === "replay-off"
            ? tr(
                "NVIDIA Instant Replay est désactivé : aucune vidéo n'a été enregistrée. Active-le avec Alt+Z > Instant Replay > Activer.",
                "NVIDIA Instant Replay is off: no video was recorded. Turn it on with Alt+Z > Instant Replay > Turn on.",
              )
            : recapError === "no-video"
              ? tr(
                  "Aucune vidéo reçue de NVIDIA. Vérifie qu'Instant Replay est activé (Alt+Z > Instant Replay > Activer).",
                  "No video received from NVIDIA. Check that Instant Replay is on (Alt+Z > Instant Replay > Turn on).",
                )
              : recapError
        }}
      </div>

      <div v-if="deleteFailed" class="ar-sub ar-dr-warn">
        <i class="fas fa-exclamation-triangle"></i>
        {{ tr("Impossible de supprimer la vidéo : elle est encore ouverte. Réessaie dans un instant.", "Could not delete the video: it is still open. Try again in a moment.") }}
      </div>

      <button type="button" @click="recapEnabled = !recapEnabled">
        <i class="fas" :class="recapEnabled ? 'fa-pause' : 'fa-play'"></i>
        {{ recapEnabled ? tr("Désactiver", "Turn off") : tr("Activer", "Turn on") }}
      </button>
      <button type="button" @click="openClipsFolder">
        <i class="fas fa-folder-open"></i> {{ tr("Ouvrir le dossier", "Open the folder") }}
      </button>

      <div class="ar-past">
        <div class="ar-sub ar-past-title">
          {{ tr("Dernières morts", "Last deaths") }} ({{ clips.length }}/10)
        </div>
        <div v-if="!clips.length" class="ar-sub">
          {{ tr("Aucune mort enregistrée pour l'instant.", "No death recorded yet.") }}
        </div>
        <div
          v-for="c in clips"
          :key="c.name"
          class="ar-past-row ar-dr-row"
          :class="{ 'is-selected': c.name === selected }"
          @click="selected = c.name"
        >
          <i class="fas fa-skull"></i>
          <div class="flex-1 min-w-0 truncate">{{ dayTime(c.at) }}</div>
          <button
            type="button"
            class="ar-icon-btn"
            :title="tr('Supprimer', 'Delete')"
            @click.stop="remove(c.name)"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </fieldset>

    <section class="ar-main">
      <div class="ar-main-head">
        <h2>{{ selectedClip ? dayTime(selectedClip.at) : "Death Recap" }}</h2>
        <div class="ar-sub">
          {{ tr(`Les ${SECONDS_BEFORE} secondes avant la mort de ton personnage.`, `The ${SECONDS_BEFORE} seconds before your character died.`) }}
        </div>
      </div>
      <div v-if="savingClip" class="ar-sub">
        <i class="fas fa-spinner fa-spin"></i> {{ tr("Récupération de la vidéo NVIDIA…", "Getting the NVIDIA video…") }}
      </div>
      <div v-if="playError" class="ar-sub ar-dr-warn">
        <i class="fas fa-exclamation-triangle"></i>
        {{
          tr(
            "Cette vidéo ne peut pas être lue ici. Choisis le format H.264 dans l'appli NVIDIA (Alt+Z > Paramètres > Capture vidéo), ou ouvre-la depuis le dossier.",
            "This video cannot be played here. Pick the H.264 format in the NVIDIA app (Alt+Z > Settings > Video capture), or open it from the folder.",
          )
        }}
      </div>
      <video
        v-if="selected"
        :key="selected"
        class="ar-dr-video"
        :src="clipUrl(selected)"
        controls
        autoplay
        @loadedmetadata="startNearDeath"
        @error="playError = true"
      ></video>
      <div v-else class="ar-empty">
        {{
          tr(
            "Quand ton personnage meurt, la vidéo de ses dernières secondes apparaît ici.",
            "When your character dies, a video of the last seconds shows up here.",
          )
        }}
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue";
import { tr, dateLocale } from "@/web/atziri-lang";
import {
  clips,
  clipUrl,
  deleteClip,
  latestClip,
  MS_AFTER,
  nvidia,
  openClipsFolder,
  recapEnabled,
  recapError,
  refreshClips,
  refreshNvidia,
  savingClip,
  SECONDS_BEFORE,
  unseenDeaths,
} from "./atziri-death-recap";

const selected = shallowRef<string | null>(latestClip.value ?? clips.value[0]?.name ?? null);
const playError = shallowRef(false);

const selectedClip = computed(() => clips.value.find((c) => c.name === selected.value));

watch(selected, () => {
  playError.value = false;
});
// a new death while the tab is open: show it right away (already seen)
watch(latestClip, (name) => {
  if (name) selected.value = name;
  unseenDeaths.value = 0;
});
// the shown clip was deleted: show the most recent one
watch(clips, (list) => {
  if (!list.some((c) => c.name === selected.value)) {
    selected.value = list[0]?.name ?? null;
  }
});

onMounted(() => {
  unseenDeaths.value = 0;
  refreshClips();
  refreshNvidia();
});

const deleteFailed = shallowRef(false);

/** Takes the clip out of the player first: Windows cannot delete an open file */
async function remove(name: string) {
  deleteFailed.value = false;
  if (selected.value === name) {
    selected.value = null;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!(await deleteClip(name))) deleteFailed.value = true;
}

/** The NVIDIA replay ends just after the death: start 15 s before the death */
function startNearDeath(e: Event) {
  const video = e.target as HTMLVideoElement;
  const start = video.duration - SECONDS_BEFORE - MS_AFTER / 1000;
  if (Number.isFinite(start) && start > 0) video.currentTime = start;
}

const tooLong = computed(() => (nvidia.value?.replaySeconds ?? 0) > 60);

const replayText = computed(() => {
  const s = nvidia.value?.replaySeconds ?? 0;
  return s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`;
});

function dayTime(t: number) {
  return new Date(t).toLocaleString(dateLocale(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
</script>
