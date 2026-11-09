import { init } from "@/assets/data";
import { parseClipboard } from "@/parser";
import { buildAge, itemToPobText } from "@/web/overlay/atziri-pob";
import { setupTests } from "@specs/vitest.setup";
import { beforeEach, describe, expect, it } from "vitest";
import { RareItem, UniqueItem } from "../Parser/items";

describe("itemToPobText (Compare in PoB)", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("rebuilds a rare bow in Path of Building's format", () => {
    const item = parseClipboard(RareItem.rawText)._unsafeUnwrap();
    const text = itemToPobText(item)!;
    const lines = text.split("\n");
    expect(lines[0]).toBe("Rarity: RARE");
    expect(lines[2]).toBe("Rider Bow");
    expect(lines).toContain("Item Level: 80");
    // two-value damage mods become their average (same average damage)
    expect(lines).toContain("Adds 43.5 to 43.5 Lightning Damage");
    expect(lines).toContain("Adds 31.5 to 31.5 Fire Damage");
    expect(lines).toContain("+57 to Accuracy Rating");
    expect(lines).toContain("15% increased Light Radius");
    expect(lines).toContain("Implicits: 0");
  });

  it("uses the unique's English name and base", () => {
    const item = parseClipboard(UniqueItem.rawText)._unsafeUnwrap();
    const lines = itemToPobText(item)!.split("\n");
    expect(lines[0]).toBe("Rarity: UNIQUE");
    expect(lines[1]).toBe(item.info.refName);
    expect(lines[2]).toBe(item.info.unique?.base);
  });
});

describe("buildAge (age of the build compared with)", () => {
  const now = Date.UTC(2026, 10, 9, 12, 0);
  it("speaks in minutes, hours, then days", () => {
    expect(buildAge(now - 20_000, true, now)).toBe("à l'instant");
    expect(buildAge(now - 5 * 60_000, true, now)).toBe("il y a 5 min");
    expect(buildAge(now - 3 * 3600_000, true, now)).toBe("il y a 3 h");
    expect(buildAge(now - 3 * 86400_000, true, now)).toBe("il y a 3 j");
    expect(buildAge(now - 3 * 3600_000, false, now)).toBe("3 h ago");
  });
});
