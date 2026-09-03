import genreVocabulary from "../../../resources/vocabularies/genres.json";
import genreSourceAliases from "../../../resources/vocabularies/genre-source-aliases.json";

import type { Genre } from "@/domain/entities/classification";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import { getLanguageFallback, localizeText } from "@/application/services/localization-service";

interface GenreVocabularyRow {
  id: string;
  ja: string;
  "zh-CN": string;
  en: string;
}

interface GenreSourceAliasRow {
  canonicalId: string;
  sourceId: string;
  ja: string;
  "zh-CN": string;
  en: string;
  sources: string[];
  note?: string;
}

const canonicalGenres = genreVocabulary.items as GenreVocabularyRow[];
const approvedAliases = genreSourceAliases.items as GenreSourceAliasRow[];
const byId = new Map(canonicalGenres.map((item) => [item.id, item]));
const canonicalIdByAlias = new Map<string, string>();

for (const item of canonicalGenres) {
  for (const value of [item.ja, item["zh-CN"], item.en]) canonicalIdByAlias.set(termKey(value), item.id);
}
for (const item of approvedAliases) {
  for (const value of [item.ja, item["zh-CN"], item.en]) {
    const key = termKey(value);
    if (key && !canonicalIdByAlias.has(key)) canonicalIdByAlias.set(key, item.canonicalId);
  }
}

/**
 * Resolve a Canonical Genre label without depending on the original user
 * reference CSV. Only approved Canonical vocabulary and curated source aliases
 * participate in runtime localization.
 */
export function localizeGenre(genre: Genre | undefined, preferred: SupportedLanguage, fallback = "—"): string {
  if (!genre) return fallback;

  const direct = genre.names[preferred]?.trim();
  if (direct) return direct;

  const canonical = byId.get(genre.id) ?? findCanonicalGenreByKnownName(genre);
  if (canonical) {
    const values: Record<SupportedLanguage, string> = {
      ja: canonical.ja,
      "zh-CN": canonical["zh-CN"],
      en: canonical.en,
    };
    for (const language of getLanguageFallback(preferred)) {
      const value = values[language]?.trim();
      if (value) return value;
    }
  }

  return localizeText(genre.names, preferred, fallback);
}

export function findApprovedGenreAlias(value: string): GenreSourceAliasRow | undefined {
  const canonicalId = canonicalIdByAlias.get(termKey(value));
  if (!canonicalId) return undefined;
  return approvedAliases.find((item) => item.canonicalId === canonicalId && [item.ja, item["zh-CN"], item.en].some((alias) => termKey(alias) === termKey(value)));
}

function findCanonicalGenreByKnownName(genre: Genre): GenreVocabularyRow | undefined {
  for (const value of Object.values(genre.names)) {
    if (!value?.trim()) continue;
    const canonicalId = canonicalIdByAlias.get(termKey(value));
    if (canonicalId) return byId.get(canonicalId);
  }
  return undefined;
}

function termKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/[\s_\-]+/g, " ");
}
