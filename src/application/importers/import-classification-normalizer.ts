import type { NormalizedImportCandidate } from "@/domain/entities/evidence";
import type { LocalizedText } from "@/domain/value-objects/localized-text";

/**
 * NFO / scraper ecosystems frequently place structural metadata, work types,
 * genres and arbitrary source labels into the same <genre>/<tag> arrays.
 *
 * Localogue must not copy that mixed bag into Canonical Genre + Tag. This
 * module is the single semantic routing boundary for imported classification
 * terms. Keep it in sync with resources/vocabularies/import-term-mappings.*
 */

export interface ControlledGenreDefinition {
  id: string;
  names: LocalizedText;
  aliases: readonly string[];
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

export const WORK_TYPE_DEFINITIONS: readonly WorkTypeDefinition[] = [
  { id: "solo", names: { ja: "単体作品", "zh-CN": "单体作品", en: "Solo" }, aliases: ["単体", "単体作品", "单体", "单体作品", "solo"] },
  { id: "co_starring", names: { ja: "共演作品", "zh-CN": "共演作品", en: "Co-starring" }, aliases: ["共演", "共演作品", "co-starring", "costarring"] },
  { id: "vr", names: { ja: "VR作品", "zh-CN": "VR作品", en: "VR" }, aliases: ["vr", "vr作品", "vr動画", "vr video"] },
  { id: "image_video", names: { ja: "イメージビデオ", "zh-CN": "写真影像", en: "Image Video" }, aliases: ["イメージビデオ", "イメージdvd", "写真影像", "image video", "image_video"] },
  { id: "compilation", names: { ja: "総集編", "zh-CN": "合辑", en: "Compilation" }, aliases: ["総集編", "总集篇", "合辑", "compilation"] },
  { id: "omnibus", names: { ja: "オムニバス", "zh-CN": "单元合集", en: "Omnibus" }, aliases: ["オムニバス", "单元合集", "omnibus"] },
  { id: "best_of", names: { ja: "ベスト", "zh-CN": "精选集", en: "Best Of" }, aliases: ["ベスト", "best", "best of", "精选集"] },
  { id: "other", names: { ja: "その他", "zh-CN": "其他", en: "Other" }, aliases: ["その他", "其他", "other"] },
] as const;

export const CONTROLLED_GENRE_DEFINITIONS: readonly ControlledGenreDefinition[] = [
  { id: "uniform", names: { ja: "制服", "zh-CN": "制服", en: "Uniform" }, aliases: ["制服", "uniform"] },
  { id: "office_lady", names: { ja: "OL", "zh-CN": "OL / 职场女性", en: "Office Lady" }, aliases: ["ol", "office lady", "职场女性", "職場女性"] },
  { id: "married_woman", names: { ja: "人妻", "zh-CN": "人妻", en: "Married Woman" }, aliases: ["人妻", "married woman"] },
  { id: "mature", names: { ja: "熟女", "zh-CN": "熟女", en: "Mature" }, aliases: ["熟女", "mature"] },
  { id: "amateur", names: { ja: "素人", "zh-CN": "素人", en: "Amateur" }, aliases: ["素人", "amateur"] },
  { id: "big_bust", names: { ja: "巨乳", "zh-CN": "巨乳", en: "Big Bust" }, aliases: ["巨乳", "big bust"] },
  { id: "small_bust", names: { ja: "貧乳", "zh-CN": "贫乳", en: "Small Bust" }, aliases: ["貧乳", "贫乳", "small bust"] },
  { id: "slender", names: { ja: "スレンダー", "zh-CN": "苗条", en: "Slender" }, aliases: ["スレンダー", "苗条", "slender"] },
  { id: "cosplay", names: { ja: "コスプレ", "zh-CN": "角色扮演", en: "Cosplay" }, aliases: ["コスプレ", "角色扮演", "cosplay"] },
  { id: "drama", names: { ja: "ドラマ", "zh-CN": "剧情", en: "Drama" }, aliases: ["ドラマ", "剧情", "劇情", "drama"] },
  { id: "documentary", names: { ja: "ドキュメンタリー", "zh-CN": "纪录", en: "Documentary" }, aliases: ["ドキュメンタリー", "纪录", "紀錄", "documentary"] },
  { id: "lesbian", names: { ja: "レズ", "zh-CN": "女同性题材", en: "Lesbian" }, aliases: ["レズ", "女同性题材", "lesbian"] },
  { id: "first_work", names: { ja: "デビュー作", "zh-CN": "出道作", en: "Debut Work" }, aliases: ["デビュー作", "出道作", "debut work"] },
  { id: "anniversary", names: { ja: "周年", "zh-CN": "周年企划", en: "Anniversary" }, aliases: ["周年", "周年企划", "anniversary"] },
  { id: "high_definition", names: { ja: "ハイビジョン", "zh-CN": "高清", en: "High Definition" }, aliases: ["ハイビジョン", "高清", "high definition"] },
] as const;

const WORK_TYPE_BY_ALIAS = aliasIndex(WORK_TYPE_DEFINITIONS);
const GENRE_BY_ALIAS = aliasIndex(CONTROLLED_GENRE_DEFINITIONS);

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
      // publisher / code-family and other structural terms are evidence, not Canonical Genre/Tag.
      continue;
    }

    if (matchesStructuralContext(term, candidate)) {
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
  const key = termKey(value);
  return CONTROLLED_GENRE_DEFINITIONS.find((item) => item.id === value) ?? GENRE_BY_ALIAS.get(key);
}

export function workTypeDefinition(id: string): WorkTypeDefinition | undefined {
  return WORK_TYPE_DEFINITIONS.find((item) => item.id === id);
}

export function controlledGenreDefinition(idOrAlias: string): ControlledGenreDefinition | undefined {
  return CONTROLLED_GENRE_DEFINITIONS.find((item) => item.id === idOrAlias) ?? GENRE_BY_ALIAS.get(termKey(idOrAlias));
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

  // Scrapers often repeat the alphabetic catalog prefix (OAE, MIDV, ...)
  // as a genre/tag. It is part of the work code family, not a Genre.
  const codePrefix = candidate.code?.match(/^([A-Z]+)(?=[-_ ]?\d)/iu)?.[1];
  if (codePrefix && termKey(codePrefix) === key) return true;
  return false;
}

function matchesKnownPerson(value: string, candidate: NormalizedImportCandidate): boolean {
  const key = termKey(value);
  return [...candidate.performers, ...candidate.directors].some((item) => termKey(item) === key);
}

function aliasIndex<T extends { aliases: readonly string[]; names: LocalizedText }>(items: readonly T[]): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) {
    for (const value of [...item.aliases, ...Object.values(item.names).filter((entry): entry is string => Boolean(entry))]) {
      result.set(termKey(value), item);
    }
  }
  return result;
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
