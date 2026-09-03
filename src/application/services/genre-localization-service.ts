import sourceGenreCatalog from "../../../resources/vocabularies/source-genre-catalog.json";

import type { Genre } from "@/domain/entities/classification";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import { getLanguageFallback, localizeText } from "@/application/services/localization-service";

interface SourceGenreCatalogItem {
  sourceId: string;
  url: string;
  ja: string;
  "zh-CN": string;
  "zh-TW": string;
  en: string;
  note?: string;
  sources: string[];
}

const sourceGenreItems = sourceGenreCatalog.items as SourceGenreCatalogItem[];
const byAlias = new Map<string, SourceGenreCatalogItem>();

for (const item of sourceGenreItems) {
  for (const value of [item.ja, item["zh-CN"], item["zh-TW"], item.en]) {
    const key = termKey(value);
    if (key && !byAlias.has(key)) byAlias.set(key, item);
  }
}

/**
 * A localization/reference lexicon for scraper genre terms.
 *
 * Important: this catalog does NOT automatically promote all 1,271 source
 * categories into Canonical Genre. Some source sites mix technical properties,
 * campaigns, release attributes, studios, and real content genres in the same
 * bucket. Canonical admission still goes through import-classification-normalizer.
 *
 * The catalog is safe to use for presentation and vocabulary review because it
 * lets Localogue recover Japanese / Simplified Chinese / English labels for an
 * already-known genre without changing its semantic dimension.
 */
export function findSourceGenreCatalogItem(value: string): SourceGenreCatalogItem | undefined {
  return byAlias.get(termKey(value));
}

export function localizeGenre(genre: Genre | undefined, preferred: SupportedLanguage, fallback = "—"): string {
  if (!genre) return fallback;

  const direct = genre.names[preferred]?.trim();
  if (direct) return direct;

  const catalog = Object.values(genre.names)
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => findSourceGenreCatalogItem(value))
    .find(Boolean);

  if (catalog) {
    const values: Record<SupportedLanguage, string> = {
      ja: catalog.ja,
      "zh-CN": catalog["zh-CN"],
      en: catalog.en,
    };
    for (const language of getLanguageFallback(preferred)) {
      const value = values[language]?.trim();
      if (value) return value;
    }
  }

  return localizeText(genre.names, preferred, fallback);
}

export function sourceGenreCatalogSize(): number {
  return sourceGenreItems.length;
}

function termKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/[\s_\-]+/g, " ");
}
