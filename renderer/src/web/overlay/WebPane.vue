<template>
  <!-- Atziri Exchange: one web page tab of the Shift + Space hub -->
  <div class="ar-body ar-browser">
    <div class="ar-browser-bar">
      <button type="button" :title="tr('Précédent', 'Back')" @click="webviewDo('goBack')">
        <i class="fas fa-arrow-left"></i>
      </button>
      <button type="button" :title="tr('Suivant', 'Forward')" @click="webviewDo('goForward')">
        <i class="fas fa-arrow-right"></i>
      </button>
      <button type="button" :title="tr('Recharger', 'Reload')" @click="webviewDo('reload')">
        <i class="fas fa-redo"></i>
      </button>
      <button type="button" :title="tr('Accueil', 'Home')" @click="load(localizeUrl(tab.home))">
        <i class="fas fa-home"></i>
      </button>
      <input
        v-model="addressInput"
        type="text"
        class="ar-search ar-address"
        spellcheck="false"
        @keydown.enter="goToAddress"
      />
      <button
        type="button"
        class="ar-quick"
        :title="tr('Ouvrir cette page dans ton navigateur habituel', 'Open this page in your usual browser')"
        @click="openExternal"
      >
        <i class="fas fa-external-link-alt"></i>
        {{ tr("Ouvrir dans mon navigateur", "Open in my browser") }}
      </button>
    </div>
    <webview
      ref="webviewEl"
      class="ar-webview"
      partition="persist:atziri-browser"
      :src="initialSrc"
      allowpopups
    ></webview>
  </div>
</template>

<script setup lang="ts">
import { shallowRef, watch, type PropType } from "vue";
import { tr } from "@/web/atziri-lang";
import {
  type WebTab,
  webTabUrls,
  webTabRequest,
  rememberTabUrl,
  localizeUrl,
} from "./atziri-hub";

const props = defineProps({
  tab: { type: Object as PropType<WebTab>, required: true },
});

// set once: later navigation goes through loadURL so the page keeps its history
const initialSrc = localizeUrl(webTabUrls.value[props.tab.id] ?? props.tab.home);
const addressInput = shallowRef(initialSrc);
// the parts of Electron's <webview> element used here
interface WebviewElement extends HTMLElement {
  loadURL(url: string): void;
  getURL(): string;
  goBack(): void;
  goForward(): void;
  reload(): void;
}
const webviewEl = shallowRef<WebviewElement | null>(null);
let ready = false;
let pendingUrl: string | null = null;

watch(webviewEl, (el) => {
  if (!el) return;
  el.addEventListener("dom-ready", () => {
    ready = true;
    if (pendingUrl) {
      const url = pendingUrl;
      pendingUrl = null;
      el.loadURL(url);
    }
  });
  const onNav = (e: Event & { url?: string }) => {
    if (!e.url) return;
    addressInput.value = e.url;
    rememberTabUrl(props.tab.id, e.url);
  };
  el.addEventListener("did-navigate", onNav as EventListener);
  el.addEventListener("did-navigate-in-page", onNav as EventListener);
});

function load(url: string) {
  addressInput.value = url;
  const el = webviewEl.value;
  if (el && ready) {
    el.loadURL(url);
  } else {
    pendingUrl = url;
  }
}

// pages requested from outside (PoEDB shortcut...)
watch(webTabRequest, (req) => {
  if (req && req.tab === props.tab.id) load(req.url);
});
if (webTabRequest.value?.tab === props.tab.id) {
  pendingUrl = webTabRequest.value.url;
}

function goToAddress() {
  let url = addressInput.value.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) {
    url =
      url.includes(".") && !url.includes(" ")
        ? `https://${url}`
        : `https://www.google.com/search?q=${encodeURIComponent(url)}`;
  }
  load(url);
}

function webviewDo(method: "goBack" | "goForward" | "reload") {
  try {
    webviewEl.value?.[method]?.();
  } catch {
    // webview not ready yet
  }
}

// window.open is turned into "open in the default browser" by the main process
function openExternal() {
  let url = addressInput.value;
  try {
    url = webviewEl.value?.getURL?.() || url;
  } catch {
    // keep the address bar value
  }
  if (/^https?:\/\//i.test(url)) window.open(url);
}
</script>
