<template>
  <div id="app" class="text-sm font-poe-sc">
    <!-- My Ritualist Overlay: the hub in a normal window, or the overlay -->
    <DesktopWindow v-if="isDesktopWindow" />
    <OverlayWindow v-else />
  </div>
</template>

<script setup lang="ts">
import OverlayWindow from "./overlay/OverlayWindow.vue";
import DesktopWindow from "./DesktopWindow.vue";
import { isDesktopWindow } from "./atziri-desktop";
</script>

<style lang="postcss">
@import url("@fortawesome/fontawesome-free/css/all.min.css");
@import url("animate.css/animate.css");
@import url("../assets/font.css");
@tailwind base;
@tailwind components;
@tailwind utilities;

.table-stripped tbody tr:nth-child(odd) {
  background: rgb(var(--c-gray-800));
}

/* Ritualist theme: display font for titles and headings */
.font-display,
h1,
h2,
h3 {
  font-family: "Inter", "Segoe UI", system-ui, sans-serif;
  letter-spacing: 0.02em;
}

/* Ritualist theme: darkened Ritualist artwork behind the main windows */
.atziri-bg {
  background-color: theme("colors.gray.800");
  background-image:
    linear-gradient(
      180deg,
      rgb(var(--c-gray-900) / 0.55) 0%,
      rgb(var(--c-gray-900) / 0.82) 45%,
      rgb(var(--c-gray-900) / 0.93) 100%
    ),
    var(--atz-price-bg, url("/images/ritualiste-bg.webp"));
  background-size: cover;
  background-position: center 40%;
}

/* Large framed artwork panel shown when the overlay is opened */
.atziri-frame {
  position: absolute;
  top: var(--atz-y, 7vh);
  bottom: var(--atz-y, 7vh);
  left: var(--atz-x, 10vw);
  right: var(--atz-x, 10vw);
  pointer-events: none;
  /* sober frame; the artwork shows behind the header, then fades out */
  border: 1px solid rgb(var(--c-gray-700));
  border-radius: 0.75rem;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.6),
    0 1rem 3rem rgba(0, 0, 0, 0.7);
  background:
    linear-gradient(
      180deg,
      rgb(var(--c-gray-900) / 0.12) 0,
      rgb(var(--c-gray-900) / 0.4) 100px,
      rgb(var(--c-gray-900) / 0.93) 180px,
      rgb(var(--c-gray-900) / 0.96) 100%
    ),
    var(--atz-hub-bg, url("/images/ritualiste-bg.webp")) center top / cover no-repeat,
    rgb(var(--c-gray-900));
  animation: atziri-frame-in 0.18s ease-out;
}

/* Corner handle to resize the Atziri frame (double-click resets the size) */
.atziri-resize {
  position: absolute;
  right: calc(var(--atz-x, 10vw) + 4px);
  bottom: calc(var(--atz-y, 7vh) + 4px);
  width: 1.1rem;
  height: 1.1rem;
  z-index: 5;
  cursor: nwse-resize;
  /* two discreet diagonal grip lines */
  background: linear-gradient(
    135deg,
    transparent 46%,
    rgb(var(--c-gray-400)) 46% 53%,
    transparent 53% 70%,
    rgb(var(--c-gray-400)) 70% 77%,
    transparent 77%
  );
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
}

@keyframes atziri-frame-in {
  from {
    opacity: 0;
    transform: scale(0.985);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

::selection {
  background: theme("colors.accent.soft");
  color: theme("colors.blue.300");
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  /* align-items: center; */
  overflow: hidden;
  justify-content: space-between;

  :focus {
    outline: 0;
  }
}

.layout-column {
  display: flex;
  flex-direction: column;
  height: 100%;
}

::-webkit-scrollbar {
  width: 0.875rem;
}

::-webkit-scrollbar-track {
  -webkit-box-shadow: inset 0 0 0.375rem rgba(0, 0, 0, 0.3);
}

::-webkit-scrollbar-thumb {
  -webkit-box-shadow: inset 0 0 0.375rem rgba(0, 0, 0, 0.5);
  background: theme("colors.gray.700");
  border-radius: 0.375rem;
}

::-webkit-scrollbar-thumb:hover {
  background: theme("colors.blue.800");
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
}

.btn {
  @apply bg-gray-700;
  @apply px-2 py-1;
  @apply text-gray-400;
  @apply leading-none;
  @apply rounded;
  border: 1px solid transparent;

  &:hover {
    @apply text-blue-300;
    border-color: theme("colors.blue.800");
    box-shadow: 0 0 0.5rem theme("colors.accent.glow");
  }
}

.btn-icon {
  @apply text-xs text-gray-600;
}

@keyframes ring {
  0% {
    -webkit-transform: rotate(-15deg);
    -ms-transform: rotate(-15deg);
    transform: rotate(-15deg);
  }

  2% {
    -webkit-transform: rotate(15deg);
    -ms-transform: rotate(15deg);
    transform: rotate(15deg);
  }

  4% {
    -webkit-transform: rotate(-18deg);
    -ms-transform: rotate(-18deg);
    transform: rotate(-18deg);
  }

  6% {
    -webkit-transform: rotate(18deg);
    -ms-transform: rotate(18deg);
    transform: rotate(18deg);
  }

  8% {
    -webkit-transform: rotate(-22deg);
    -ms-transform: rotate(-22deg);
    transform: rotate(-22deg);
  }

  10% {
    -webkit-transform: rotate(22deg);
    -ms-transform: rotate(22deg);
    transform: rotate(22deg);
  }

  12% {
    -webkit-transform: rotate(-18deg);
    -ms-transform: rotate(-18deg);
    transform: rotate(-18deg);
  }

  14% {
    -webkit-transform: rotate(18deg);
    -ms-transform: rotate(18deg);
    transform: rotate(18deg);
  }

  16% {
    -webkit-transform: rotate(-12deg);
    -ms-transform: rotate(-12deg);
    transform: rotate(-12deg);
  }

  18% {
    -webkit-transform: rotate(12deg);
    -ms-transform: rotate(12deg);
    transform: rotate(12deg);
  }

  20% {
    -webkit-transform: rotate(0deg);
    -ms-transform: rotate(0deg);
    transform: rotate(0deg);
  }
}

.faa-ring {
  animation: ring 2s ease;
  transform-origin-x: 50%;
  transform-origin-y: 0px;
  transform-origin-z: initial;
}
</style>
