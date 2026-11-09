// My Ritualist Overlay: "Compare in PoB" from the trade site of the
// Shift + Space page (Trade tab).
//
// A small script added to the trade page puts a "PoB" button on every
// listing (Alt + D also works on the hovered listing). It fetches the listing
// from the trade site and hands it to the overlay through a console message;
// the item is turned into Path of Building text and compared like an item
// copied in game. The trade site gives the modifiers in English already.

/** Prefix of the console message carrying a listing's item (JSON) */
export const TRADE_ITEM_MESSAGE = "__RITUALIST_POB__";

/** Script added to the trade page (www.pathofexile.com/trade2/...) */
export const TRADE_PAGE_SCRIPT = `(() => {
  if (window.__ritualistPob) return;
  window.__ritualistPob = true;
  const ROW = ".resultset .row[data-id]";

  async function send(row, button) {
    const id = row.dataset.id;
    const query = location.pathname.split("/").filter(Boolean).pop();
    if (!id) return;
    if (button) button.textContent = "…";
    try {
      const res = await fetch("/api/trade2/fetch/" + id + "?query=" + query + "&realm=poe2");
      const data = await res.json();
      const item = data && data.result && data.result[0] && data.result[0].item;
      if (item) console.log(${JSON.stringify(TRADE_ITEM_MESSAGE)} + JSON.stringify(item));
    } catch (e) {
      console.log(${JSON.stringify(TRADE_ITEM_MESSAGE)} + JSON.stringify({ error: String(e) }));
    } finally {
      if (button) button.textContent = "PoB";
    }
  }

  function addButtons() {
    for (const row of document.querySelectorAll(ROW)) {
      if (row.querySelector(".ritualist-pob")) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ritualist-pob";
      button.textContent = "PoB";
      button.title = "Comparer avec ton build (Path of Building) — ou Alt + D sur l'annonce";
      button.style.cssText = "margin:4px;padding:2px 10px;border:1px solid #b57cf0;border-radius:6px;" +
        "background:#151629;color:#e6e2d8;font:600 12px Inter,Segoe UI,sans-serif;cursor:pointer;";
      button.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); send(row, button); });
      (row.querySelector(".right") || row).appendChild(button);
    }
  }

  new MutationObserver(addButtons).observe(document.body, { childList: true, subtree: true });
  addButtons();

  let hovered = null;
  document.addEventListener("mouseover", (e) => {
    const row = e.target && e.target.closest && e.target.closest(ROW);
    if (row) hovered = row;
  });
  document.addEventListener("keydown", (e) => {
    if (e.altKey && !e.ctrlKey && e.code === "KeyD" && hovered) {
      e.preventDefault();
      send(hovered, hovered.querySelector(".ritualist-pob"));
    }
  });
})();`;

interface TradeMod {
  description?: string;
}

interface TradeItem {
  name?: string;
  typeLine?: string;
  baseType?: string;
  rarity?: string;
  ilvl?: number;
  corrupted?: boolean;
  properties?: Array<{ name: string; values: Array<[string, number]> }>;
  implicitMods?: Array<TradeMod | string>;
  explicitMods?: Array<TradeMod | string>;
  enchantMods?: Array<TradeMod | string>;
  runeMods?: Array<TradeMod | string>;
  fracturedMods?: Array<TradeMod | string>;
  desecratedMods?: Array<TradeMod | string>;
  craftedMods?: Array<TradeMod | string>;
}

/** "+24% to [Resistances|Fire Resistance]" -> "+24% to Fire Resistance" */
function cleanMarkup(text: string) {
  return text.replace(/\[([^\]|]+)\|([^\]]+)\]/g, "$2").replace(/\[([^\]]+)\]/g, "$1");
}

function modLines(mods: Array<TradeMod | string> | undefined, prefix = "") {
  return (mods ?? []).flatMap((m) => {
    const text = typeof m === "string" ? m : m.description ?? "";
    return cleanMarkup(text)
      .split("\n")
      .filter(Boolean)
      .map((line) => prefix + line);
  });
}

/** Path of Building item text of a trade listing (the trade site is in English) */
export function tradeItemToPobText(item: TradeItem): string | null {
  const base = item.baseType || item.typeLine;
  if (!base) return null;
  const rarity = (item.rarity ?? "Normal").toUpperCase();
  const lines = [`Rarity: ${rarity}`];
  if (rarity === "RARE" || rarity === "UNIQUE") lines.push(item.name || "Trade Item", base);
  else lines.push(base);

  const quality = item.properties?.find((p) => /quality/i.test(p.name))?.values?.[0]?.[0];
  const q = quality ? /\d+/.exec(quality)?.[0] : undefined;
  if (q) lines.push(`Quality: ${q}`);
  if (item.ilvl) lines.push(`Item Level: ${item.ilvl}`);

  const innate = [
    ...modLines(item.enchantMods, "{enchant}"),
    ...modLines(item.runeMods, "{rune}"),
    ...modLines(item.implicitMods),
  ];
  const explicit = [
    ...modLines(item.fracturedMods, "{fractured}"),
    ...modLines(item.explicitMods),
    ...modLines(item.desecratedMods, "{desecrated}"),
    ...modLines(item.craftedMods, "{crafted}"),
  ];
  lines.push(`Implicits: ${innate.length}`, ...innate, ...explicit);
  if (item.corrupted) lines.push("Corrupted");
  return lines.join("\n");
}

/** Handles a console message of the trade page; true if it was a listing */
export function readTradeMessage(message: string): TradeItem | { error: string } | null {
  if (!message.startsWith(TRADE_ITEM_MESSAGE)) return null;
  try {
    return JSON.parse(message.slice(TRADE_ITEM_MESSAGE.length));
  } catch {
    return null;
  }
}
