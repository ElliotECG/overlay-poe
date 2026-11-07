<template>
  <!-- Atziri Exchange: the user's Atziri Regex page, unchanged, in a tab -->
  <div class="ar-body ar-browser">
    <div class="ar-browser-bar">
      <button
        type="button"
        class="ar-paste"
        :title="tr('Colle la regex dans la recherche du coffre ou du marchand', 'Pastes the regex into the stash or vendor search')"
        @click="pasteInGame"
      >
        <i class="fas fa-paste"></i> {{ tr("Coller dans le jeu", "Paste in game") }}
      </button>
      <span class="ar-regex-preview" :class="{ 'is-empty': !preview }">
        {{ preview || tr("Choisis tes mods dans Atziri Regex ci-dessous.", "Pick your mods in Atziri Regex below.") }}
      </span>
      <span v-if="message" class="ar-regex-msg">{{ message }}</span>
    </div>
    <iframe
      ref="frameEl"
      class="ar-webview ar-regex-frame"
      src="/atziri-regex.html"
      @load="watchOutput"
    ></iframe>
  </div>
</template>

<script setup lang="ts">
import { shallowRef, onUnmounted } from "vue";
import { Host } from "@/web/background/IPC";
import { tr } from "@/web/atziri-lang";

const frameEl = shallowRef<HTMLIFrameElement | null>(null);
const preview = shallowRef("");
const message = shallowRef("");
let observer: MutationObserver | undefined;

/** Current regex shown by the page (#out), empty when nothing is selected */
function readRegex(): string {
  const out = frameEl.value?.contentDocument?.getElementById("out");
  if (!out || out.classList.contains("empty")) return "";
  return (out.textContent ?? "").trim();
}

function watchOutput() {
  observer?.disconnect();
  const out = frameEl.value?.contentDocument?.getElementById("out");
  preview.value = readRegex();
  if (!out) return;
  observer = new MutationObserver(() => {
    preview.value = readRegex();
  });
  observer.observe(out, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
  });
}

onUnmounted(() => observer?.disconnect());

let messageTimer: ReturnType<typeof setTimeout> | undefined;
function flash(text: string) {
  message.value = text;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => (message.value = ""), 3000);
}

// Same action as the stash search widget: Ctrl+F, paste, Enter in the game
function pasteInGame() {
  const text = readRegex();
  if (!text) {
    flash(tr("Aucune regex sélectionnée.", "No regex selected."));
    return;
  }
  Host.sendEvent({
    name: "CLIENT->MAIN::user-action",
    payload: { action: "stash-search", text },
  });
  flash(tr("Collée dans le jeu.", "Pasted in game."));
}
</script>
