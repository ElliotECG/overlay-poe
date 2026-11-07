<template>
  <div>
    <div class="flex justify-between">
      <div class="flex flex-wrap items-center pb-3 gap-2">
        <filter-btn-numeric
          v-if="filters.socketNumber"
          :filter="filters.socketNumber"
          :name="t('item.gem_sockets')"
        />
        <filter-btn-numeric
          v-if="filters.linkedSockets"
          :filter="filters.linkedSockets"
          :name="t('item.linked_sockets')"
        />
        <filter-btn-numeric
          v-if="filters.mapTier"
          :filter="filters.mapTier"
          :name="t('item.map_tier')"
        />
        <filter-btn-numeric
          v-if="filters.awardedAscendancyPoints"
          :filter="filters.awardedAscendancyPoints"
          :name="t('item.ascendancy_points')"
        />
        <filter-btn-numeric
          v-if="filters.areaLevel"
          :filter="filters.areaLevel"
          :name="t('item.area_level')"
        />
        <filter-btn-numeric
          v-if="filters.heistWingsRevealed"
          :filter="filters.heistWingsRevealed"
          :name="t('item.heist_wings_revealed')"
        />
        <filter-btn-numeric
          v-if="filters.sentinelCharge"
          :filter="filters.sentinelCharge"
          :name="t('item.sentinel_charge')"
        />
        <filter-btn-logical
          v-if="filters.mapBlighted"
          readonly
          :filter="{ disabled: false }"
          :text="filters.mapBlighted.value"
        />
        <filter-btn-logical
          v-if="filters.rarity?.value === 'magic'"
          readonly
          :filter="{ disabled: false }"
          text="Magic"
        />
        <filter-btn-logical
          v-if="filters.rarity?.value === 'normal'"
          readonly
          :filter="{ disabled: false }"
          text="Normal"
        />
        <filter-btn-logical
          v-if="filters.discriminator?.value"
          readonly
          :filter="{ disabled: false }"
          :text="filters.discriminator.value"
        />
        <filter-btn-numeric
          v-if="filters.itemLevel"
          :filter="filters.itemLevel"
          :name="t('item.item_level')"
        />
        <filter-btn-numeric
          v-if="filters.requires?.level"
          :filter="filters.requires?.level"
          :name="t('item.requires_level')"
        />
        <filter-btn-numeric
          v-if="filters.stackSize"
          :filter="filters.stackSize"
          :name="t('item.stock')"
        />
        <filter-btn-numeric
          v-if="filters.whiteSockets"
          :filter="filters.whiteSockets"
          :name="t('item.white_sockets')"
        />
        <filter-btn-numeric
          v-if="filters.augmentSockets"
          :filter="filters.augmentSockets"
          :name="t('item.augment_sockets')"
        />
        <filter-btn-numeric
          v-if="filters.gemLevel"
          :filter="filters.gemLevel"
          :name="t('item.gem_level')"
        />
        <filter-btn-numeric
          v-if="filters.quality"
          :filter="filters.quality"
          :name="t('item.quality')"
        />
        <template v-if="filters.influences">
          <filter-btn-logical
            v-for="influence of filters.influences"
            :key="influence.value"
            :filter="influence"
            :text="influence.value"
            :img="`/images/influence-${influence.value}.png`"
          />
        </template>
        <!-- Implicitly should only be tier or plain unid from create-item-filters -->
        <filter-btn-numeric
          v-if="filters.unidentifiedTier"
          :filter="filters.unidentifiedTier"
          :name="t('item.unidentified_tier')"
        />
        <filter-btn-logical
          v-else-if="filters.unidentified"
          :filter="filters.unidentified"
          :text="t('item.unidentified')"
        />
        <filter-btn-logical
          v-if="filters.veiled"
          :filter="filters.veiled"
          :text="t('item.veiled')"
        />
        <filter-btn-logical
          v-if="filters.foil"
          :filter="filters.foil"
          :text="t('item.foil_unique')"
        />
        <filter-btn-logical
          v-if="filters.mirrored"
          active
          :filter="filters.mirrored"
          :text="
            t(filters.mirrored.disabled ? 'item.not_mirrored' : 'item.mirrored')
          "
        />
        <filter-btn-logical
          v-if="filters.sanctified"
          active
          :filter="filters.sanctified"
          :text="
            t(
              filters.sanctified.disabled
                ? 'item.not_sanctified'
                : 'item.sanctified',
            )
          "
        />
        <filter-btn-logical
          v-if="filters.ultimatumHint"
          :filter="filters.ultimatumHint"
          :text="t(`item.${filters.ultimatumHint.value.toLowerCase()}`)"
        />

        <filter-btn-logical
          v-if="hasStats"
          :collapse="statsVisibility.disabled"
          :filter="statsVisibility"
          :active="totalSelectedMods > 0"
          :text="
            totalSelectedMods > 0
              ? t('filters.selected_some', [totalSelectedMods, stats.length])
              : t('filters.selected_none')
          "
        />
      </div>
      <div
        v-if="showItemEditor !== 'none'"
        class="flex items-center bg-gray-900 rounded border border-gray-500 justify-center shrink-0 w-8 h-8"
      >
        <popover :delay="[0, 500]" placement="right">
          <template #target>
            <i
              v-if="canHaveCatalyst && !currentCatalyst"
              class="fas fa-question-circle text-gray-400 text-xl" />
            <img
              v-else-if="currentCatalyst"
              :src="currentCatalyst.icon"
              class="max-w-full max-h-full overflow-hidden" /><img
              v-else
              :src="
                item.augmentSockets?.augments.some((a) => a)
                  ? '/images/augments/rune.png'
                  : '/images/augments/empty-socket.png'
              "
              class="max-w-full max-h-full overflow-hidden"
          /></template>
          <template #content>
            <item-editor-v2 :item="item" />
          </template>
        </popover>
      </div>
    </div>
    <!-- Handled parse error -->
    <div
      v-if="!statsVisibility.disabled && hasStats"
      class="mb-4"
      :class="presets.length > 1 ? 'mt-1' : 'mt-4'"
    >
      <div class="flex" v-if="presets.length > 1">
        <div class="w-5 border-b border-gray-700" />
        <div
          class="flex divide-x border-gray-700 border-t border-l border-r rounded-t overflow-hidden"
        >
          <button
            v-for="preset in presets"
            :class="[$style.presetBtn, { [$style.active]: preset.active }]"
            @click="selectPreset(preset.id)"
          >
            {{ t(preset.id) }}
          </button>
        </div>
        <div class="flex-1 border-b border-gray-700" />
      </div>
      <form @submit.prevent="handleStatsSubmit">
        <!-- Atziri Exchange: lines grouped by kind, each group can fold -->
        <template v-for="group in statGroups" :key="group.id">
          <div
            v-if="statGroups.length > 1"
            :class="$style.groupHead"
            @click="toggleGroup(group.id)"
          >
            <i
              class="fas text-xs"
              :class="
                collapsedGroups.includes(group.id)
                  ? 'fa-chevron-right'
                  : 'fa-chevron-down'
              "
            ></i>
            <span>{{ tr(group.label, group.labelEn) }}</span>
            <span :class="$style.groupCount"
              >{{ group.selected }}/{{ group.stats.length }}</span
            >
            <button
              type="button"
              :class="$style.groupBtn"
              @click.stop="setGroup(group.stats, true)"
            >
              {{ tr("Tout", "All") }}
            </button>
            <button
              type="button"
              :class="$style.groupBtn"
              @click.stop="setGroup(group.stats, false)"
            >
              {{ tr("Aucun", "None") }}
            </button>
          </div>
          <template v-if="!collapsedGroups.includes(group.id)">
            <filter-modifier
              v-for="filter of group.stats"
              :key="filter.tag + '/' + filter.text"
              :filter="filter"
              :item="item"
              :show-sources="showFilterSources"
              @submit="handleStatsSubmit"
            />
          </template>
        </template>
        <div
          v-if="!filteredStats.length && !showUnknownMods"
          class="border-b border-gray-700 py-2"
        >
          {{ t("filters.empty") }}
        </div>
        <template v-if="showUnknownMods">
          <unknown-modifier
            v-for="stat of item.unknownModifiers"
            :key="stat.type + '/' + stat.text"
            :stat="stat"
            :item-text="item.rawText"
          />
        </template>
        <template v-if="showMissingFracturedWarning">
          <div class="py-2 border-b border-gray-700 flex flex-col">
            <div class="pb-1 flex items-baseline">
              <i
                class="w-5 shrink-0 fas fa-exclamation-triangle text-orange-400"
              ></i>
              <div
                class="search-text mr-1 relative flex min-w-0"
                style="line-height: 1rem"
              >
                {{ t("Unable to determine fractured stat") }}
              </div>
            </div>
            <div class="ml-5 text-xs leading-none">
              <span class="text-gray-600"
                >{{ t("filters.tag_explicit") }} &mdash;
              </span>
              <a
                target="_blank"
                href="https://www.pathofexile.com/forum/view-thread/3891367"
                class="text-orange-400 underline hidden"
                >Bug Report</a
              >
            </div>
          </div>
        </template>
        <input type="submit" class="hidden" />
      </form>
      <div class="flex gap-x-4">
        <button
          @click="statsVisibility.disabled = !statsVisibility.disabled"
          class="bg-gray-700 px-2 py-1 text-gray-400 leading-none rounded-b w-40"
        >
          {{ t("filters.collapse") }}
          <i class="fas fa-chevron-up pl-1 text-xs text-gray-600"></i>
        </button>
        <ui-toggle
          v-if="filteredStats.length !== stats.length"
          v-model="showHidden"
          class="text-gray-400 pt-2"
          >{{ t(hiddenLabel) }}</ui-toggle
        >
        <!-- Atziri Exchange: exact values instead of the ±% range -->
        <ui-toggle
          v-model="exactValues"
          class="ml-auto text-gray-400 pt-2"
          >{{ tr("Valeur exacte", "Exact value") }}</ui-toggle
        >
        <ui-toggle v-model="showFilterSources" class="text-gray-400 pt-2">{{
          t("filters.mods_toggle")
        }}</ui-toggle>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  watch,
  shallowRef,
  shallowReactive,
  computed,
  PropType,
} from "vue";
import { useI18n } from "vue-i18n";
import UiToggle from "@/web/ui/UiToggle.vue";
import { tr } from "@/web/atziri-lang";
import ItemEditorV2 from "@/web/price-check/item-editor/ItemEditorV2.vue";
import FilterModifier from "./FilterModifier.vue";
import FilterBtnNumeric from "./FilterBtnNumeric.vue";
import FilterBtnLogical from "./FilterBtnLogical.vue";
import UnknownModifier from "./UnknownModifier.vue";
import { ItemFilters, StatFilter, FilterTag } from "./interfaces";
import {
  ParsedItem,
  ItemRarity,
  ItemCategory,
  itemIsModifiable,
} from "@/parser";
import FilterBtnDropdown from "./FilterBtnDropdown.vue";
import { ModifierType } from "@/parser/modifiers";
import Popover from "@/web/ui/Popover.vue";
import { getItemEditorType } from "../item-editor/item-editor.js";
import { ItemEditorType } from "@/parser/meta.js";
import { CATALYST_TYPES } from "@/assets/data/index.js";

export default defineComponent({
  name: "FiltersBlock",
  emits: ["submit", "preset"],
  components: {
    FilterModifier,
    FilterBtnNumeric,
    FilterBtnLogical,
    FilterBtnDropdown,
    ItemEditorV2,
    UnknownModifier,
    Popover,
    UiToggle,
  },
  props: {
    presets: {
      type: Array as PropType<Array<{ id: string; active: boolean }>>,
      required: true,
    },
    filters: {
      type: Object as PropType<ItemFilters>,
      required: true,
    },
    stats: {
      type: Array as PropType<StatFilter[]>,
      required: true,
    },
    item: {
      type: Object as PropType<ParsedItem>,
      required: true,
    },
  },
  setup(props, ctx) {
    const statsVisibility = shallowReactive({ disabled: false });
    const showHidden = shallowRef(false);
    const showFilterSources = shallowRef(false);

    watch(
      () => props.item,
      () => {
        showHidden.value = false;
        statsVisibility.disabled = false;
        exactValues.value = false;
        savedRolls = new WeakMap();
      },
    );

    // --- Atziri Exchange: "Valeur exacte" toggle ---
    const exactValues = shallowRef(false);
    let savedRolls = new WeakMap<
      StatFilter,
      { min: number | "" | undefined; max: number | "" | undefined }
    >();
    watch(exactValues, (exact) => {
      for (const filter of props.stats) {
        const roll = filter.roll;
        if (!roll) continue;
        if (exact) {
          savedRolls.set(filter, { min: roll.min, max: roll.max });
          // keep the side the filter searches on (min, or max when inverted)
          if (roll.min !== undefined && roll.min !== "") roll.min = roll.value;
          if (roll.max !== undefined && roll.max !== "") roll.max = roll.value;
          if ((roll.min === undefined || roll.min === "") &&
              (roll.max === undefined || roll.max === "")) {
            roll.min = roll.value;
          }
        } else {
          const saved = savedRolls.get(filter);
          if (saved) {
            roll.min = saved.min;
            roll.max = saved.max;
          }
        }
      }
    });

    // --- Atziri Exchange: lines grouped by kind ---
    const collapsedGroups = shallowRef<string[]>([]);
    const GROUPS: Array<{ id: string; label: string; labelEn: string }> = [
      { id: "property", label: "Propriétés", labelEn: "Properties" },
      { id: "pseudo", label: "Pseudo", labelEn: "Pseudo" },
      { id: "augment", label: "Augmentations", labelEn: "Augments" },
      { id: "implicit", label: "Implicites", labelEn: "Implicits" },
      { id: "prefix", label: "Préfixes", labelEn: "Prefixes" },
      { id: "suffix", label: "Suffixes", labelEn: "Suffixes" },
      { id: "explicit", label: "Explicites", labelEn: "Explicits" },
      { id: "other", label: "Autres", labelEn: "Other" },
    ];
    function groupOf(filter: StatFilter): string {
      switch (filter.tag) {
        case FilterTag.Property:
          return "property";
        case FilterTag.Pseudo:
          return "pseudo";
        case FilterTag.Augment:
        case FilterTag.AddedAugment:
          return "augment";
        case FilterTag.Implicit:
        case FilterTag.Enchant:
        case FilterTag.Corrupted:
          return "implicit";
      }
      const generation = filter.sources?.[0]?.modifier.info.generation;
      if (generation === "prefix") return "prefix";
      if (generation === "suffix") return "suffix";
      return filter.tag === FilterTag.Variant || filter.tag === FilterTag.Skill
        ? "other"
        : "explicit";
    }
    function toggleGroup(id: string) {
      collapsedGroups.value = collapsedGroups.value.includes(id)
        ? collapsedGroups.value.filter((g) => g !== id)
        : [...collapsedGroups.value, id];
    }
    function setGroup(stats: StatFilter[], on: boolean) {
      for (const s of stats) s.disabled = !on;
    }

    const showUnknownMods = computed(
      () =>
        props.item.unknownModifiers.length &&
        props.item.category !== ItemCategory.Sentinel &&
        !(
          props.item.category === ItemCategory.Map &&
          props.item.rarity === ItemRarity.Unique
        ),
    );

    const showItemEditor = computed(() => {
      if (!itemIsModifiable(props.item)) {
        // can still change socketed items on non-modifiable items
        return (props.item.augmentSockets?.augments.length ?? 0) > 0
          ? getItemEditorType(props.item)
          : ItemEditorType.None;
      }

      return getItemEditorType(props.item);
    });
    // For handling filling augments
    // watch(
    //   () => props.filters.itemEditorSelection?.value,
    //   (selected, prev) => {
    //     const normalCase = selected !== prev && props.filters.tempAugmentStorage;
    //     if (normalCase && selected !== undefined) {
    //       // If last wasn't empty
    //       if (
    //         prev !== "None" &&
    //         props.filters.tempAugmentStorage &&
    //         props.filters.tempAugmentStorage.length > 0
    //       ) {
    //         // Remove current augment
    //         handleRemoveItemEdits(
    //           props.stats,
    //           props.item,
    //           props.filters.tempAugmentStorage!,
    //         );
    //       }
    //       // If we didn't choose empty
    //       if (selected !== "None") {
    //         // add new augment
    //         handleApplyItemEdits(
    //           props.stats,
    //           props.item,
    //           props.filters.tempAugmentStorage!,
    //           selected,
    //         );
    //       }
    //     }
    //   },
    // );

    const { t } = useI18n();

    const filteredStats = computed(() => {
      if (showHidden.value) {
        return props.stats.filter((s) => s.hidden);
      } else {
        return props.stats.filter((s) => !s.hidden);
      }
    });

    const statGroups = computed(() =>
      GROUPS.map((g) => {
        const stats = filteredStats.value.filter((s) => groupOf(s) === g.id);
        return {
          ...g,
          stats,
          selected: stats.filter((s) => !s.disabled).length,
        };
      }).filter((g) => g.stats.length),
    );

    return {
      t,
      tr,
      exactValues,
      collapsedGroups,
      statGroups,
      toggleGroup,
      setGroup,
      statsVisibility,
      showHidden,
      showFilterSources,
      totalSelectedMods: computed(() => {
        return props.stats.filter((stat) => !stat.disabled).length;
      }),
      filteredStats,
      showUnknownMods,
      hasStats: computed(
        () =>
          props.stats.length ||
          (showUnknownMods.value && props.item.rarity === ItemRarity.Unique) ||
          props.presets.length > 1,
      ),
      handleStatsSubmit() {
        ctx.emit("submit");
      },
      selectPreset(id: string) {
        ctx.emit("preset", id);
      },
      hiddenLabel: computed(() => {
        if (
          props.item.category === ItemCategory.Map ||
          props.item.category === ItemCategory.Waystone
        ) {
          return t("filters.hidden_explicit_toggle");
        } else {
          return t("filters.hidden_toggle");
        }
      }),
      showMissingFracturedWarning: computed(() => {
        return (
          // is fractured
          props.item.isFractured &&
          // on base item preset
          props.presets.some(
            (p) => p.id === "filters.preset_base_item" && p.active,
          ) &&
          // but item itself has no fractured mods
          !props.item.statsByType.some(
            (calc) => calc.type === ModifierType.Fractured,
          )
        );
      }),
      showItemEditor,
      canHaveCatalyst: computed(() => {
        return (
          props.item.category === ItemCategory.Ring ||
          props.item.category === ItemCategory.Amulet ||
          props.item.category === ItemCategory.Jewel
        );
      }),
      currentCatalyst: computed(() => {
        if (
          !props.item.qualityType ||
          !props.item.quality ||
          showItemEditor.value !== ItemEditorType.Catalyst
        )
          return undefined;

        const catalysts =
          props.item.category === ItemCategory.Jewel
            ? CATALYST_TYPES.Refined
            : CATALYST_TYPES.Normal;

        return catalysts.find((c) => c.tags[1] === props.item.qualityType);
      }),
    };
  },
});
</script>

<style lang="postcss" module>
/* Atziri Exchange: group headers of the mod lines */
.groupHead {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 3px 8px;
  border-radius: 5px;
  cursor: pointer;
  user-select: none;
  background: theme("colors.blue.900");
  color: theme("colors.blue.400");
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.groupCount {
  margin-left: auto;
  color: theme("colors.gray.400");
  font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace;
}

.groupBtn {
  font-size: 0.68rem;
  text-transform: none;
  letter-spacing: 0;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid theme("colors.blue.800");
  color: theme("colors.blue.300");

  &:hover {
    border-color: theme("colors.blue.400");
  }
}

.presetBtn {
  @apply border-gray-700 bg-gray-800;
  @apply px-2;
  min-width: 3rem;

  &:hover {
    @apply bg-gray-700;
  }

  &.active {
    background: linear-gradient(
      to bottom,
      theme("colors.gray.900"),
      theme("colors.gray.800")
    );
  }
}
</style>
