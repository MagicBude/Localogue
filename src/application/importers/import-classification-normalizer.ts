import classificationTermAliases from "../../../resources/vocabularies/classification-term-aliases.json";
import genreVocabulary from "../../../resources/vocabularies/genres.json";
import genreSourceAliases from "../../../resources/vocabularies/genre-source-aliases.json";
import sourceOnlyVocabulary from "../../../resources/vocabularies/source-only-classifications.json";
import workTypeVocabulary from "../../../resources/vocabularies/work-types.json";

import type { NormalizedImportCandidate } from "@/domain/entities/evidence";
import type { LocalizedText } from "@/domain/value-objects/localized-text";

/**
 * NFO / scraper ecosystems frequently place structural metadata, work types,
 * genres and arbitrary source labels into the same <genre>/<tag> arrays.
 *
 * Localogue must not copy that mixed bag into Canonical Genre + Tag. This
 * module is the single semantic routing boundary for imported classification
 * terms. Runtime decisions are data-driven by resources/vocabularies/* rather
 * than by an ever-growing hard-coded switch table.
 */

export type ControlledGenreFacet = "theme" | "role" | "wardrobe" | "body" | "act" | "practice";

export interface ControlledGenreDefinition {
  id: string;
  names: LocalizedText;
  aliases: readonly string[];
  facets: readonly ControlledGenreFacet[];
}

export interface WorkTypeDefinition {
  id: string;
  names: LocalizedText;
  aliases: readonly string[];
}

export interface ImportClassificationNormalization {
  candidate: NormalizedImportCandidate;
  unmappedTerms: string[];
  structuralTerms: string[];
}

interface VocabularyRow {
  id: string;
  ja: string;
  "zh-CN": string;
  en: string;
}

interface GenreVocabularyRow extends VocabularyRow {
  facets?: ControlledGenreFacet[];
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
  candidateTargets: string[];
  sources: string[];
  note?: string;
}

interface SourceOnlyRow extends VocabularyRow {
  aliases?: string[];
}

const TERM_ALIASES = classificationTermAliases.items as ClassificationTermAliasRow[];
const REVIEW_TERM_KEYS = new Set(TERM_ALIASES.filter((item) => item.status === "review-required").map((item) => termKey(item.term)));
const APPROVED_SINGLE_TARGET_ALIASES = TERM_ALIASES.filter(
  (item) => item.status === "approved" && item.targets.length === 1,
);

const GENRE_SOURCE_ALIASES = genreSourceAliases.items as GenreSourceAliasRow[];
const EXTRA_ALIASES_BY_TARGET = new Map<string, string[]>();

function registerTargetAlias(target: string, value: string): void {
  const cleaned = value?.trim();
  if (!cleaned || REVIEW_TERM_KEYS.has(termKey(cleaned))) return;
  const values = EXTRA_ALIASES_BY_TARGET.get(target) ?? [];
  values.push(cleaned);
  EXTRA_ALIASES_BY_TARGET.set(target, values);
}

for (const item of APPROVED_SINGLE_TARGET_ALIASES) {
  registerTargetAlias(item.targets[0], item.term);
}
for (const item of GENRE_SOURCE_ALIASES) {
  const target = `genre:${item.canonicalId}`;
  registerTargetAlias(target, item.ja);
  registerTargetAlias(target, item["zh-CN"]);
  registerTargetAlias(target, item.en);
}

/** Canonical Genre is defined by resources/vocabularies/genres.*. */
export const CONTROLLED_GENRE_DEFINITIONS: readonly ControlledGenreDefinition[] =
  (genreVocabulary.items as GenreVocabularyRow[]).map((item) => ({
    id: item.id,
    names: { ja: item.ja, "zh-CN": item["zh-CN"], en: item.en },
    facets: item.facets ?? [],
    aliases: uniqueClean([
      item.ja,
      item["zh-CN"],
      item.en,
      ...(EXTRA_ALIASES_BY_TARGET.get(`genre:${item.id}`) ?? []),
    ]),
  }));

/** Work Type is also a governed vocabulary, not an importer-local enum. */
export const WORK_TYPE_DEFINITIONS: readonly WorkTypeDefinition[] =
  (workTypeVocabulary.items as VocabularyRow[]).map((item) => ({
    id: item.id,
    names: { ja: item.ja, "zh-CN": item["zh-CN"], en: item.en },
    aliases: uniqueClean([
      item.ja,
      item["zh-CN"],
      item.en,
      ...(EXTRA_ALIASES_BY_TARGET.get(`workType:${item.id}`) ?? []),
    ]),
  }));

const SOURCE_ONLY_DEFINITIONS = (sourceOnlyVocabulary.items as SourceOnlyRow[]).map((item) => ({
  id: item.id,
  aliases: uniqueClean([
    item.ja,
    item["zh-CN"],
    item.en,
    ...(item.aliases ?? []),
    ...(EXTRA_ALIASES_BY_TARGET.get(`sourceOnly:${item.id}`) ?? []),
  ]),
}));

// Conflicting exact aliases fail closed: they are absent from the automatic
// index and therefore surface as unmapped/review material instead of guessing.
const WORK_TYPE_BY_ALIAS = uniqueAliasIndex(WORK_TYPE_DEFINITIONS);
const GENRE_BY_ALIAS = uniqueAliasIndex(CONTROLLED_GENRE_DEFINITIONS);
const SOURCE_ONLY_KEYS = uniqueAliasKeySet(SOURCE_ONLY_DEFINITIONS);

/** Route mixed source classification terms into Localogue's canonical dimensions. */
export function normalizeImportedClassifications(input: NormalizedImportCandidate): ImportClassificationNormalization {
  const candidate: NormalizedImportCandidate = {
    ...input,
    performers: uniqueClean(input.performers),
    directors: uniqueClean(input.directors),
    series: uniqueClean(input.series),
    genres: [],
    tags: [],
    workTypes: [],
  };

  const structuralTerms: string[] = [];
  const unmappedTerms: string[] = [];
  const series = new Set(candidate.series.filter((value) => !matchesKnownPerson(value, candidate)));
  const workTypes = new Set<string>();
  const genres = new Set<string>();
  const tags = new Set<string>();

  for (const value of input.workTypes) {
    const mapped = workTypeFor(value);
    if (mapped) workTypes.add(mapped.id);
    else if (value.trim()) unmappedTerms.push(value.trim());
  }

  const mixedTerms = uniqueClean([...input.genres, ...input.tags]);
  for (const raw of mixedTerms) {
    const term = raw.trim();
    if (!term) continue;

    const prefixed = parseStructuralPrefix(term);
    if (prefixed) {
      structuralTerms.push(term);
      if (prefixed.kind === "series" && prefixed.value && !matchesKnownPerson(prefixed.value, candidate)) {
        series.add(prefixed.value);
      } else if (prefixed.kind === "maker" && prefixed.value && !candidate.maker) {
        candidate.maker = prefixed.value;
      } else if (prefixed.kind === "label" && prefixed.value && !candidate.label) {
        candidate.label = prefixed.value;
      } else if (prefixed.kind === "tag" && prefixed.value) {
        tags.add(prefixed.value);
      }
      continue;
    }

    if (matchesStructuralContext(term, candidate)) {
      structuralTerms.push(term);
      continue;
    }

    if (isSourceOnlyClassification(term)) {
      structuralTerms.push(term);
      continue;
    }

    const workType = workTypeFor(term);
    if (workType) {
      workTypes.add(workType.id);
      continue;
    }

    const genre = genreFor(term);
    if (genre) {
      genres.add(genre.id);
      continue;
    }

    // review-required compound/ambiguous aliases intentionally arrive here.
    // They remain visible to the existing unmapped-classification review flow.
    unmappedTerms.push(term);
  }

  candidate.series = uniqueClean([...series]);
  candidate.workTypes = [...workTypes];
  candidate.genres = [...genres];
  candidate.tags = uniqueClean([...tags]);

  return {
    candidate,
    structuralTerms: uniqueClean(structuralTerms),
    unmappedTerms: uniqueClean(unmappedTerms),
  };
}

export function workTypeFor(value: string): WorkTypeDefinition | undefined {
  return WORK_TYPE_DEFINITIONS.find((item) => item.id === value) ?? WORK_TYPE_BY_ALIAS.get(termKey(value));
}

export function genreFor(value: string): ControlledGenreDefinition | undefined {
  return CONTROLLED_GENRE_DEFINITIONS.find((item) => item.id === value) ?? GENRE_BY_ALIAS.get(termKey(value));
}

export function workTypeDefinition(id: string): WorkTypeDefinition | undefined {
  return WORK_TYPE_DEFINITIONS.find((item) => item.id === id);
}

export function controlledGenreDefinition(idOrAlias: string): ControlledGenreDefinition | undefined {
  return CONTROLLED_GENRE_DEFINITIONS.find((item) => item.id === idOrAlias) ?? GENRE_BY_ALIAS.get(termKey(idOrAlias));
}

function isSourceOnlyClassification(value: string): boolean {
  return SOURCE_ONLY_KEYS.has(termKey(value));
}

function parseStructuralPrefix(value: string): { kind: "series" | "maker" | "label" | "publisher" | "tag"; value: string } | undefined {
  const patterns: Array<[RegExp, "series" | "maker" | "label" | "publisher" | "tag"]> = [
    [/^(?:系列|シリーズ|series)\s*[:：]\s*(.+)$/iu, "series"],
    [/^(?:片商|メーカー|maker|studio)\s*[:：]\s*(.+)$/iu, "maker"],
    [/^(?:厂牌|廠牌|レーベル|label)\s*[:：]\s*(.+)$/iu, "label"],
    [/^(?:发行|發行|配給|publisher)\s*[:：]\s*(.+)$/iu, "publisher"],
    [/^(?:标签|標籤|タグ|tag)\s*[:：]\s*(.+)$/iu, "tag"],
  ];
  for (const [pattern, kind] of patterns) {
    const match = value.match(pattern);
    if (match?.[1]?.trim()) return { kind, value: match[1].trim() };
  }
  return undefined;
}

function matchesStructuralContext(value: string, candidate: NormalizedImportCandidate): boolean {
  const key = termKey(value);
  if (!key) return true;
  if (candidate.performers.some((item) => termKey(item) === key)) return true;
  if (candidate.directors.some((item) => termKey(item) === key)) return true;
  if (candidate.maker && termKey(candidate.maker) === key) return true;
  if (candidate.label && termKey(candidate.label) === key) return true;
  if (candidate.series.some((item) => termKey(item) === key)) return true;

  const codePrefix = candidate.code?.match(/^([A-Z]+)(?=[-_ ]?\d)/iu)?.[1];
  if (codePrefix && termKey(codePrefix) === key) return true;
  return false;
}

function matchesKnownPerson(value: string, candidate: NormalizedImportCandidate): boolean {
  const key = termKey(value);
  return [...candidate.performers, ...candidate.directors].some((item) => termKey(item) === key);
}

function uniqueAliasIndex<T extends { id: string; aliases: readonly string[]; names: LocalizedText }>(items: readonly T[]): Map<string, T> {
  const candidates = new Map<string, T>();
  const conflicts = new Set<string>();
  for (const item of items) {
    for (const value of [...item.aliases, ...Object.values(item.names).filter((entry): entry is string => Boolean(entry))]) {
      const key = termKey(value);
      if (!key || conflicts.has(key)) continue;
      const existing = candidates.get(key);
      if (existing && existing.id !== item.id) {
        candidates.delete(key);
        conflicts.add(key);
      } else {
        candidates.set(key, item);
      }
    }
  }
  return candidates;
}

function uniqueAliasKeySet(items: readonly { id: string; aliases: readonly string[] }[]): Set<string> {
  const ownerByKey = new Map<string, string>();
  const conflicts = new Set<string>();
  for (const item of items) {
    for (const value of item.aliases) {
      const key = termKey(value);
      if (!key || conflicts.has(key)) continue;
      const owner = ownerByKey.get(key);
      if (owner && owner !== item.id) {
        ownerByKey.delete(key);
        conflicts.add(key);
      } else {
        ownerByKey.set(key, item.id);
      }
    }
  }
  return new Set(ownerByKey.keys());
}

function termKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/[\s_\-]+/g, " ");
}

function uniqueClean(values: readonly string[]): string[] {
  const output: string[] = [];
  const keys = new Set<string>();
  for (const value of values) {
    const cleaned = value?.trim();
    if (!cleaned) continue;
    const key = termKey(cleaned);
    if (keys.has(key)) continue;
    keys.add(key);
    output.push(cleaned);
  }
  return output;
}
