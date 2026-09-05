import classificationTermAliases from "../../../resources/vocabularies/classification-term-aliases.json";
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
  idSource: "fanza" | "javbus" | "javdb" | "javlibrary" | null;
  idStatus: string;
  ja: string;
  "zh-CN": string;
  en: string;
  sources: string[];
  note?: string;
}

interface ClassificationTermAliasRow {
  term: string;
  status: "approved" | "review-required";
  targets: string[];
}

const canonicalGenres = genreVocabulary.items as GenreVocabularyRow[];
const approvedProviderAliases = genreSourceAliases.items as GenreSourceAliasRow[];
const classificationAliases = classificationTermAliases.items as ClassificationTermAliasRow[];
const reviewTermKeys = new Set(classificationAliases.filter((item) => item.status === "review-required").map((item) => termKey(item.term)));
const byId = new Map(canonicalGenres.map((item) => [item.id, item]));
const aliasOwners = new Map<string, string>();
const ambiguousAliases = new Set<string>();

function registerAlias(value: string, canonicalId: string): void {
  const key = termKey(value);
  if (!key || reviewTermKeys.has(key) || ambiguousAliases.has(key)) return;
  const existing = aliasOwners.get(key);
  if (existing && existing !== canonicalId) {
    aliasOwners.delete(key);
    ambiguousAliases.add(key);
    return;
  }
  aliasOwners.set(key, canonicalId);
}

for (const item of canonicalGenres) {
  for (const value of [item.ja, item["zh-CN"], item.en]) registerAlias(value, item.id);
}
for (const item of approvedProviderAliases) {
  for (const value of [item.ja, item["zh-CN"], item.en]) registerAlias(value, item.canonicalId);
}
for (const item of classificationAliases) {
  if (item.status !== "approved" || item.targets.length !== 1 || !item.targets[0].startsWith("genre:")) continue;
  registerAlias(item.term, item.targets[0].slice("genre:".length));
}

/**
 * Resolve a Canonical Genre label from stable ID first, then from reviewed
 * exact aliases. Unreviewed/ambiguous terms never participate in localization.
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
  const canonicalId = aliasOwners.get(termKey(value));
  if (!canonicalId) return undefined;
  return approvedProviderAliases.find(
    (item) => item.canonicalId === canonicalId
      && [item.ja, item["zh-CN"], item.en].some((alias) => termKey(alias) === termKey(value)),
  );
}

function findCanonicalGenreByKnownName(genre: Genre): GenreVocabularyRow | undefined {
  for (const value of Object.values(genre.names)) {
    if (!value?.trim()) continue;
    const canonicalId = aliasOwners.get(termKey(value));
    if (canonicalId) return byId.get(canonicalId);
  }
  return undefined;
}

function termKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/[\s_\-]+/g, " ");
}
