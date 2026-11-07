<template>
  <div class="max-w-md p-2">
    <!-- Atziri Exchange: league, stat range, core currency, currency filter
         and hover tooltip moved to the "Atziri réglage" page -->
    <div class="mb-2">
      <div class="flex-1 mb-1">{{ t("settings.account_name") }}</div>
      <div class="mb-4">
        <input
          v-model="accountName"
          class="rounded bg-gray-900 px-1 block w-full mb-1 font-poe"
        />
      </div>
    </div>
    <div class="mb-2">
      <div class="flex-1 mb-1">{{ t(":show_seller") }}</div>
      <div class="mb-1 flex">
        <ui-radio v-model="showSeller" :value="false" class="mr-4">{{
          t("No")
        }}</ui-radio>
        <ui-radio v-model="showSeller" value="account" class="mr-4">{{
          t("settings.account_name")
        }}</ui-radio>
        <ui-radio v-model="showSeller" value="ign">{{
          t("settings.last_char_name")
        }}</ui-radio>
      </div>
      <div class="mb-4 italic text-gray-500">{{ t(":highlight_hint") }}</div>
    </div>

    <div class="mb-2">
      <ui-checkbox class="mb-1" v-model="rememberListingType">{{
        t(":remember_listing")
      }}</ui-checkbox>
      <div class="mb-4 italic text-gray-500">
        {{ t(":remember_listing_note") }}
      </div>
    </div>

    <ui-checkbox class="mb-4" v-model="activateStockFilter">{{
      t(":select_stock")
    }}</ui-checkbox>
    <div class="mb-4">
      <div class="flex-1 mb-1">{{ t(":show_volume") }}</div>
      <div class="mb-1 flex">
        <ui-radio v-model="currencyVolume" value="none" class="mr-4">{{
          t("None")
        }}</ui-radio>
        <ui-radio v-model="currencyVolume" value="value" class="mr-4">{{
          t("Currency / Hour")
        }}</ui-radio>
        <ui-radio v-model="currencyVolume" value="item" class="mr-4">{{
          t("Items / Hour")
        }}</ui-radio>
        <ui-radio v-model="currencyVolume" value="both">{{
          t("Both")
        }}</ui-radio>
      </div>
    </div>
    <ui-checkbox class="mb-4" v-model="requestPricePrediction"
      >{{ t(":show_prediction") }}
      <span class="bg-gray-700 px-1 rounded"
        >www.poeprices.info</span
      ></ui-checkbox
    >
    <ui-checkbox class="mb-4" v-model="showCursor">{{
      t(":cursor_pos")
    }}</ui-checkbox>


    <ui-checkbox class="mb-4" v-model="defaultAllSelected">{{
      t(":default_all_selected")
    }}</ui-checkbox>
    <ui-checkbox class="mb-4" v-model="alwaysShowTier">{{
      t(":always_show_tier")
    }}</ui-checkbox>

    <div class="mb-4" :class="{ 'p-2 bg-orange-600 rounded': builtinBrowser }">
      <ui-checkbox v-model="builtinBrowser">{{
        t(":enable_browser")
      }}</ui-checkbox>
      <div v-if="builtinBrowser" class="mt-1">
        {{ t(":builtin_browser_warning") }}
      </div>
    </div>
    <div class="border-2 rounded border-gray-700 mb-2">
      <div class="bg-gray-700 p-2 mb-2">{{ t(":warn_expensive") }}</div>
      <ui-checkbox
        class="mb-4 mx-2"
        :values="['app', 'api']"
        v-model="collapseListings"
        >{{ t(":accurate_collapsed") }}</ui-checkbox
      >
      <div class="mb-2 mx-2">
        <div class="flex-1 mb-1">{{ t(":auto_search") }}</div>
        <div class="mb-4 flex">
          <ui-toggle
            v-if="hotkeyQuick"
            v-model="smartInitialSearch"
            class="mr-6"
          >
            <span class="bg-gray-900 text-gray-500 rounded px-2">{{
              hotkeyQuick
            }}</span>
          </ui-toggle>
          <ui-toggle v-if="hotkeyLocked" v-model="lockedInitialSearch">
            <span class="bg-gray-900 text-gray-500 rounded px-2">{{
              hotkeyLocked
            }}</span>
          </ui-toggle>
        </div>
      </div>
      <div class="mb-2 mx-2">
        <div class="flex-1 mb-1">{{ t(":extra_delay") }}</div>
        <div class="flex">
          <div class="flex mr-6">
            <input
              v-model.number="apiLatencySeconds"
              class="rounded bg-gray-900 px-1 block w-16 mb-1 font-poe text-center"
            />
            <span class="ml-2">{{ t("seconds") }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="border-2 rounded border-gray-700 mb-2">
      <div class="bg-gray-700 p-2 mb-2">{{ t(":warn_advanced") }}</div>

      <div class="mb-2 mx-2">
        <div class="flex-1 mb-1">{{ t(":initial_delay") }}</div>
        <div class="flex">
          <div class="flex mr-6">
            <input
              v-model.number="initialDelay"
              class="rounded bg-gray-900 px-1 block w-16 mb-1 font-poe text-center"
            />
            <span class="ml-2">{{ t("milliseconds") }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useI18nNs } from "@/web/i18n";
import UiRadio from "@/web/ui/UiRadio.vue";
import UiCheckbox from "@/web/ui/UiCheckbox.vue";
import UiToggle from "@/web/ui/UiToggle.vue";
import UiErrorBox from "@/web/ui/UiErrorBox.vue";
import { configModelValue, configProp, findWidget } from "../settings/utils.js";
import type { PriceCheckWidget } from "@/web/overlay/interfaces";
import { useLeagues } from "../background/Leagues";
import { getAugmentNameByRef } from "./filters/fill-augments.js";
import { usePoeninja } from "../background/Prices.js";
import UiItemImg from "../ui/UiItemImg.vue";

export default defineComponent({
  name: "price_check.name",
  components: { UiRadio, UiCheckbox, UiToggle, UiErrorBox, UiItemImg },
  props: configProp(),
  setup(props) {
    const configWidget = computed(
      () => findWidget<PriceCheckWidget>("price-check", props.config)!,
    );

    const leagues = useLeagues();
    const { availableCoreCurrencies } = usePoeninja();
    const { t } = useI18nNs("price_check");

    return {
      t,
      leagueId: configModelValue(() => props.config, "leagueId"),
      customLeagueId: computed<string>({
        get: () =>
          !leagues.list.value.some(
            (league) => league.id === props.config.leagueId,
          )
            ? (props.config.leagueId ?? "")
            : "",
        set: (value) => {
          props.config.leagueId = value;
        },
      }),
      accountName: configModelValue(() => props.config, "accountName"),
      showSeller: configModelValue(() => configWidget.value, "showSeller"),
      activateStockFilter: configModelValue(
        () => configWidget.value,
        "activateStockFilter",
      ),
      showCursor: configModelValue(() => configWidget.value, "showCursor"),
      builtinBrowser: configModelValue(
        () => configWidget.value,
        "builtinBrowser",
      ),
      requestPricePrediction: configModelValue(
        () => configWidget.value,
        "requestPricePrediction",
      ),
      collapseListings: configModelValue(
        () => configWidget.value,
        "collapseListings",
      ),
      hotkeyQuick: computed(() =>
        configWidget.value.hotkey
          ? `${configWidget.value.hotkeyHold} + ${configWidget.value.hotkey}`
          : null,
      ),
      hotkeyLocked: computed(() => configWidget.value.hotkeyLocked),
      smartInitialSearch: configModelValue(
        () => configWidget.value,
        "smartInitialSearch",
      ),
      lockedInitialSearch: configModelValue(
        () => configWidget.value,
        "lockedInitialSearch",
      ),
      rememberCurrency: configModelValue(
        () => configWidget.value,
        "rememberCurrency",
      ),
      rememberListingType: configModelValue(
        () => configWidget.value,
        "rememberListingType",
      ),
      coreCurrency: configModelValue(() => configWidget.value, "coreCurrency"),
      currencyVolume: configModelValue(
        () => configWidget.value,
        "currencyVolume",
      ),
      searchStatRange: computed<number>({
        get() {
          return configWidget.value.searchStatRange;
        },
        set(value) {
          if (typeof value !== "number") return;

          if (value >= 0 && value <= 50) {
            configWidget.value.searchStatRange = value;
          }
        },
      }),
      apiLatencySeconds: computed<number>({
        get() {
          return configWidget.value.apiLatencySeconds;
        },
        set(value) {
          if (typeof value !== "number") return;

          configWidget.value.apiLatencySeconds = Math.min(
            Math.max(value, 0.5),
            10,
          );
        },
      }),
      defaultAllSelected: configModelValue(
        () => configWidget.value,
        "defaultAllSelected",
      ),
      leagues,
      availableCoreCurrencies,
      tooltipHover: configModelValue(
        () => configWidget.value,
        "itemHoverTooltip",
      ),
      alwaysShowTier: configModelValue(
        () => configWidget.value,
        "alwaysShowTier",
      ),
      initialDelay: computed<number>({
        get() {
          return configWidget.value.initialDelay;
        },
        set(value) {
          if (typeof value !== "number") return;

          configWidget.value.initialDelay = Math.min(Math.max(value, 5), 400);
        },
      }),
      getAugmentNameByRef,
    };
  },
});
</script>
