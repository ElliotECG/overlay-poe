// Atziri Exchange: the texts added by Atziri follow the overlay language.
// French when the language is French, English for every other language.
import { AppConfig } from "@/web/Config";

export function isFrench(): boolean {
  try {
    return AppConfig().language === "fr";
  } catch {
    return true; // config not loaded yet
  }
}

/** tr("Favoris", "Favorites") */
export function tr(fr: string, en: string): string {
  return isFrench() ? fr : en;
}

/** "fr-FR" or "en-GB", for dates and numbers */
export function dateLocale(): string {
  return isFrench() ? "fr-FR" : "en-GB";
}
