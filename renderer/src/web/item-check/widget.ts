import type { Widget } from "../overlay/widgets.js";
import type { MapCheckConfig } from "../map-check/common.js";

export interface ItemCheckWidget extends Widget {
  hotkey: string | null;
  wikiKey: string | null;
  poedbKey: string | null;
  craftOfExileKey: string | null;
  stashSearchKey: string | null;
  samePricedKey: string | null;
  // My Ritualist Overlay: compare the item with the build in Path of Building
  pobCompareKey?: string | null;
  samePricedType: "price" | "both";
  maps: MapCheckConfig;
}
