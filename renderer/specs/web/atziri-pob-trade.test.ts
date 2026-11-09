import { describe, expect, it } from "vitest";
import {
  readTradeMessage,
  TRADE_ITEM_MESSAGE,
  tradeItemToPobText,
} from "@/web/overlay/atziri-pob-trade";

// a real listing of the trade site (trimmed), Forbidden Rites
const RING = {
  name: "Pain Finger",
  typeLine: "Ruby Ring",
  baseType: "Ruby Ring",
  rarity: "Rare",
  ilvl: 41,
  properties: [{ name: "Ring", values: [] }],
  implicitMods: [{ description: "+24% to [Resistances|Fire Resistance]" }],
  explicitMods: [
    { description: "16% increased [Cold] Damage" },
    { description: "+15 to [Evasion] Rating" },
    { description: "+19 to [Strength|Strength]" },
    { description: "Gain 9 Life per enemy killed" },
  ],
};

describe("tradeItemToPobText (Compare in PoB from the trade site)", () => {
  it("writes the listing in Path of Building's format", () => {
    expect(tradeItemToPobText(RING)!.split("\n")).toEqual([
      "Rarity: RARE",
      "Pain Finger",
      "Ruby Ring",
      "Item Level: 41",
      "Implicits: 1",
      "+24% to Fire Resistance",
      "16% increased Cold Damage",
      "+15 to Evasion Rating",
      "+19 to Strength",
      "Gain 9 Life per enemy killed",
    ]);
  });

  it("keeps quality, runes and corruption", () => {
    const text = tradeItemToPobText({
      name: "Doom Spike",
      baseType: "Runeforged Winged Spear",
      rarity: "Rare",
      properties: [{ name: "[Quality]", values: [["+20%", 1]] }],
      runeMods: ["Adds 1 to 30 [Lightning] Damage"],
      explicitMods: ["Adds 20 to 300 [Lightning] Damage"],
      corrupted: true,
    })!.split("\n");
    expect(text).toContain("Quality: 20");
    expect(text).toContain("{rune}Adds 1 to 30 Lightning Damage");
    expect(text).toContain("Adds 20 to 300 Lightning Damage");
    expect(text[text.length - 1]).toBe("Corrupted");
  });

  it("only reads its own console messages", () => {
    expect(readTradeMessage("hello")).toBeNull();
    expect(readTradeMessage(TRADE_ITEM_MESSAGE + JSON.stringify(RING))).toEqual(RING);
  });
});
