<template>
  <transition
    enter-active-class="animate__animated animate__fadeIn"
    leave-active-class="animate__animated animate__backOutDown"
  >
    <div :class="$style.widget" v-if="show">
      <div :class="$style.box">
        <div class="py-2 px-4">
          <div class="text-base">My Ritualist Overlay</div>
          <p>{{ t("app_is_ready") }}</p>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { Host } from "@/web/background/IPC";
import { AppConfig } from "@/web/Config";

const { t } = useI18n();

const show = shallowRef(false);

Host.onEvent("MAIN->OVERLAY::overlay-attached", () => {
  if (!show.value && AppConfig().showAttachNotification) {
    show.value = true;
    setTimeout(() => {
      show.value = false;
    }, 2500);
  }
});
</script>

<style lang="postcss" module>
.widget {
  position: absolute;
  display: flex;
  width: 100%;
  justify-content: center;
  bottom: 20%;
}

.box {
  position: relative;
  display: flex;
  @apply bg-gray-800;
  @apply text-gray-100;
  @apply rounded;
  box-shadow: 0px 0px 1px 2px rgb(255 255 255 / 20%);
}

.box::before {
  position: absolute;
  content: "";
  /* Atziri Exchange: Atziri medallion instead of the upstream jeweller orb */
  background: url("/icon.png") no-repeat center/contain;
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  width: 64px;
  height: 64px;
  border-radius: 50%;
  @apply mr-3;
  pointer-events: none;
  filter: drop-shadow(2px 4px 6px #000);
}
</style>
