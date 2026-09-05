import type { ControlledGenreFacet } from "@/application/importers/import-classification-normalizer";
import type { WorkQuery } from "@/domain/queries/work-query";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";

/** 分类浏览的稳定维度。这里使用 Domain Query 字段，而不是页面自行过滤 Work。 */
export type CatalogKind = "makers" | "labels" | "series" | "genres" | "directors" | "workTypes" | "tags";
export type CatalogUsageFilter = "used" | "unused" | "all";
export type GenreFacetFilter = ControlledGenreFacet | "all" | "other";

export const GENRE_FACET_ORDER: readonly ControlledGenreFacet[] = ["theme", "role", "wardrobe", "body", "act", "practice"];

export interface CatalogSelection { kind: CatalogKind; id: string }
export interface CatalogItem {
  id: string;
  label: string;
  sortKey: string;
  count: number;
  searchValues: string[];
  subtitle?: string;
  genreFacets?: readonly ControlledGenreFacet[];
}

/** 把目录选择转换成统一 WorkQuery，确保目录入口和 Works 页共享同一查询语义。 */
export function catalogQuery(selection: CatalogSelection): WorkQuery {
  switch (selection.kind) {
    case "makers": return { sort: "release_desc", makerIds: [selection.id] };
    case "labels": return { sort: "release_desc", labelIds: [selection.id] };
    case "series": return { sort: "release_desc", seriesIds: [selection.id] };
    case "genres": return { sort: "release_desc", genreIds: [selection.id] };
    case "directors": return { sort: "release_desc", directorIds: [selection.id] };
    case "workTypes": return { sort: "release_desc", workTypeIds: [selection.id] };
    case "tags": return { sort: "release_desc", tagIds: [selection.id] };
  }
}

export function catalogTitle(kind: CatalogKind): string {
  return ({ makers: "maker", labels: "label", series: "series", genres: "genre", directors: "director", workTypes: "work type", tags: "tag" } as const)[kind];
}

export function catalogUsageLabels(language: SupportedLanguage): Record<CatalogUsageFilter, string> {
  if (language === "ja") return { used: "作品あり", unused: "作品なし", all: "すべて" };
  if (language === "en") return { used: "With works", unused: "Without works", all: "All" };
  return { used: "有作品", unused: "无作品", all: "全部" };
}

export function filterCatalogItems(items: CatalogItem[], usageFilter: CatalogUsageFilter, search: string): CatalogItem[] {
  const query = normalizeSearch(search);
  return items.filter((item) => {
    if (usageFilter === "used" && item.count <= 0) return false;
    if (usageFilter === "unused" && item.count > 0) return false;
    return !query || item.searchValues.some((value) => normalizeSearch(value).includes(query));
  });
}

export function filterGenreFacetItems(items: CatalogItem[], facet: GenreFacetFilter): CatalogItem[] {
  if (facet === "all") return items;
  if (facet === "other") return items.filter((item) => !item.genreFacets?.length);
  return items.filter((item) => item.genreFacets?.includes(facet));
}

export function groupGenreItemsByPrimaryFacet(items: CatalogItem[]): Array<{ facet: GenreFacetFilter; items: CatalogItem[] }> {
  const groups = new Map<GenreFacetFilter, CatalogItem[]>();
  for (const item of items) {
    const facet: GenreFacetFilter = item.genreFacets?.[0] ?? "other";
    groups.set(facet, [...(groups.get(facet) ?? []), item]);
  }
  return [...GENRE_FACET_ORDER, "other" as const].map((facet) => ({ facet, items: groups.get(facet) ?? [] })).filter((group) => group.items.length);
}

export function genreFacetLabel(facet: GenreFacetFilter, language: SupportedLanguage): string {
  const labels: Record<GenreFacetFilter, Record<SupportedLanguage, string>> = {
    all: { "zh-CN": "全部分组", ja: "すべての分類", en: "All groups" }, theme: { "zh-CN": "主题", ja: "テーマ", en: "Theme" }, role: { "zh-CN": "角色", ja: "役割", en: "Role" }, wardrobe: { "zh-CN": "服装", ja: "衣装", en: "Wardrobe" }, body: { "zh-CN": "体型与外观", ja: "体型・外見", en: "Body & Appearance" }, act: { "zh-CN": "行为", ja: "行為", en: "Act" }, practice: { "zh-CN": "玩法与偏好", ja: "プレイ・嗜好", en: "Practice & Fetish" }, other: { "zh-CN": "其他 / 自定义", ja: "その他 / カスタム", en: "Other / Custom" },
  };
  return labels[facet][language];
}

export function catalogCommunityDescription(language: SupportedLanguage): string {
  if (language === "ja") return "作品ありは現在の Library Profile に実際に関連する項目だけを表示します。作品なし / すべてでは、レビュー済みでまだ作品に登場していない Maker・Label・Series を読み取り専用 Community Catalog から補います。";
  if (language === "en") return "With works reflects only actual links in the current Library Profile. Without works / All also adds reviewed Maker, Label, and Series entries from the read-only Community Catalog even when no current work uses them yet.";
  return "有作品只反映当前 Library Profile 的实际关联；无作品 / 全部还会补充只读 Community Catalog，让已经审核但尚未出现在作品中的 Maker、Label、Series 也可见。";
}

export function genreFacetDescription(language: SupportedLanguage): string {
  if (language === "ja") return "すべて表示では主分類ごとに一度だけ配置し、個別分類では兼属する Genre も含めます。作品タイプや媒体属性は別ディメンションです。";
  if (language === "en") return "All groups place each Genre once by its primary facet; a specific facet also includes Genres that belong to multiple facets. Work types and media attributes remain separate.";
  return "全部分组按主分面各显示一次；切换具体分面时也会包含兼属该分面的 Genre。作品类型与媒介属性保持独立。";
}

export function genreFacetAriaLabel(language: SupportedLanguage): string {
  return language === "ja" ? "Genre 分類フィルター" : language === "en" ? "Genre facet filter" : "Genre 分组筛选";
}

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}
