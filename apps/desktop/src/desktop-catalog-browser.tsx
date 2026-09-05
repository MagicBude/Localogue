import { useState, type ReactNode } from "react";

import {
  getPreferredPersonName,
  localizeText,
} from "@/application/services/localization-service";
import { localizeGenre } from "@/application/services/genre-localization-service";
import {
  CONTROLLED_GENRE_DEFINITIONS,
  WORK_TYPE_DEFINITIONS,
  type ControlledGenreFacet,
} from "@/application/importers/import-classification-normalizer";
import type { WorkQuery, WorkSearchResult } from "@/domain/queries/work-query";
import type { LocalizedText, SupportedLanguage } from "@/domain/value-objects/localized-text";
import { DesktopWorkExplorer } from "./desktop-work-explorer";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { useDesktopI18n } from "./desktop-i18n";
import { useStableAsyncData } from "./use-stable-async-data";

type CatalogKind = "makers" | "labels" | "series" | "genres" | "directors" | "workTypes" | "tags";
type CatalogUsageFilter = "used" | "unused" | "all";
type GenreFacetFilter = ControlledGenreFacet | "all" | "other";

const GENRE_FACET_ORDER: readonly ControlledGenreFacet[] = ["theme", "role", "wardrobe", "body", "act", "practice"];

interface CatalogSelection {
  kind: CatalogKind;
  id: string;
}

interface CatalogItem {
  id: string;
  label: string;
  count: number;
  searchValues: string[];
  genreFacets?: readonly ControlledGenreFacet[];
}

export function DesktopCatalogBrowser({
  repository,
  openWork,
}: {
  repository: TauriLibraryRepository;
  openWork: (id: string) => void;
}) {
  const { t, uiLanguage, metadataLanguage } = useDesktopI18n();
  const [selection, setSelection] = useState<CatalogSelection | null>(null);
  const [usageFilter, setUsageFilter] = useState<CatalogUsageFilter>("used");
  const [genreFacet, setGenreFacet] = useState<GenreFacetFilter>("all");
  const [search, setSearch] = useState("");
  const usageLabels = catalogUsageLabels(uiLanguage);
  const data = useAsyncCatalogData(async () => {
    const [result, organizations, series, libraryGenres, tags, people] = await Promise.all([
      repository.listWorks({ page: 1, pageSize: 1 }),
      repository.listOrganizations(),
      repository.listSeries(),
      repository.listGenres(),
      repository.listTags(),
      repository.listPeople({ page: 1, pageSize: 100000 }),
    ]);
    const peopleById = new Map(people.items.map((person) => [person.id, person]));

    const controlledGenres = CONTROLLED_GENRE_DEFINITIONS.map((item) => ({
      id: item.id,
      label: localizeText(item.names, metadataLanguage, item.id),
      count: facetCount(result, "genres", item.id),
      searchValues: uniqueSearchValues([item.id, ...Object.values(item.names), ...item.aliases].filter((value): value is string => Boolean(value))),
      genreFacets: item.facets,
    }));
    const libraryGenreItems = libraryGenres.map((item) => ({
      id: item.id,
      label: localizeGenre(item, metadataLanguage, item.id),
      count: facetCount(result, "genres", item.id),
      searchValues: uniqueSearchValues(
        [item.id, ...Object.values(item.names)].filter((value): value is string => Boolean(value)),
      ),
    }));
    const controlledWorkTypes = WORK_TYPE_DEFINITIONS.map((item) => ({
      id: item.id,
      label: localizeText(item.names, metadataLanguage, item.id),
      count: facetCount(result, "workTypes", item.id),
      searchValues: uniqueSearchValues([item.id, ...Object.values(item.names), ...item.aliases].filter((value): value is string => Boolean(value))),
    }));
    const facetWorkTypes = result.facets.workTypes.map((facet) => ({
      id: facet.id,
      label: facet.id,
      count: facet.count,
      searchValues: [facet.id],
    }));

    return {
      makers: organizations
        .filter((item) => item.kind === "maker")
        .map((item) => catalogEntityItem(item.id, item.names, metadataLanguage, facetCount(result, "makers", item.id)))
        .sort(catalogSort),
      labels: organizations
        .filter((item) => item.kind === "label")
        .map((item) => catalogEntityItem(item.id, item.names, metadataLanguage, facetCount(result, "labels", item.id)))
        .sort(catalogSort),
      series: series
        .map((item) => catalogEntityItem(item.id, item.names, metadataLanguage, facetCount(result, "series", item.id)))
        .sort(catalogSort),
      genres: mergeCatalogItems(controlledGenres, libraryGenreItems),
      tags: tags
        .map((item) => catalogEntityItem(item.id, item.names, metadataLanguage, facetCount(result, "tags", item.id)))
        .sort(catalogSort),
      directors: result.facets.directors.map((facet) => ({
        id: facet.id,
        label: peopleById.has(facet.id) ? getPreferredPersonName(peopleById.get(facet.id)!, metadataLanguage) : facet.id,
        count: facet.count,
        searchValues: [facet.id, peopleById.has(facet.id) ? getPreferredPersonName(peopleById.get(facet.id)!, metadataLanguage) : facet.id],
      })).sort(catalogSort),
      workTypes: mergeCatalogItems(controlledWorkTypes, facetWorkTypes),
    };
  }, [repository, metadataLanguage]);

  if (data.loading) return <BrowserState>{t("正在生成分类索引…")}</BrowserState>;
  if (data.error || !data.value) return <BrowserState error>{data.error ?? t("无法读取分类索引。")}</BrowserState>;

  if (selection) {
    const selectionLabel = data.value[selection.kind].find((item) => item.id === selection.id)?.label ?? selection.id;
    return (
      <div className="page-stack">
        <button className="back-button" onClick={() => setSelection(null)}>← {t("返回分类浏览")}</button>
        <section className="page-title">
          <span className="eyebrow">CATALOG · {catalogTitle(selection.kind).toUpperCase()}</span>
          <h1>{selectionLabel}</h1>
          <p>{t("从分类索引进入后仍然可以继续组合其他 Facet；这一点与 Web 分类详情页保持一致。")}</p>
        </section>
        <DesktopWorkExplorer
          key={`${selection.kind}:${selection.id}`}
          repository={repository}
          onOpen={openWork}
          initialQuery={catalogQuery(selection)}
          storageKey="localogue.desktop.catalog-work-view"
        />
      </div>
    );
  }

  const sections: Array<{ kind: CatalogKind; title: string; eyebrow: string; items: CatalogItem[] }> = [
    { kind: "genres", title: t("题材"), eyebrow: "GENRES", items: data.value.genres },
    { kind: "workTypes", title: t("作品类型"), eyebrow: "WORK TYPES", items: data.value.workTypes },
    { kind: "tags", title: t("标签"), eyebrow: "TAGS", items: data.value.tags },
    { kind: "makers", title: t("厂商"), eyebrow: "MAKERS", items: data.value.makers },
    { kind: "labels", title: t("厂牌"), eyebrow: "LABELS", items: data.value.labels },
    { kind: "series", title: t("系列"), eyebrow: "SERIES", items: data.value.series },
    { kind: "directors", title: t("导演"), eyebrow: "DIRECTORS", items: data.value.directors },
  ];

  return (
    <div className="page-stack">
      <section className="page-title">
        <span className="eyebrow">EXPLORE · CATALOG INDEX</span>
        <h1>{t("分类浏览")}</h1>
        <p>{t("对齐 Web 的厂商、厂牌、系列、Genre、导演、作品类型和 Tag 索引；点击任意分类后继续使用完整作品多维筛选。")}</p>
      </section>

      <section className="settings-card form-card">
        <label className="search-box">
          <span>{t("搜索")}</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`${t("名称")} / ID`}
          />
        </label>
        <div className="button-row" aria-label={`${t("作品")} filter`}>
          <button
            className={usageFilter === "used" ? "primary-button" : "ghost-button"}
            type="button"
            onClick={() => setUsageFilter("used")}
          >
            {usageLabels.used}
          </button>
          <button
            className={usageFilter === "unused" ? "primary-button" : "ghost-button"}
            type="button"
            onClick={() => setUsageFilter("unused")}
          >
            {usageLabels.unused}
          </button>
          <button
            className={usageFilter === "all" ? "primary-button" : "ghost-button"}
            type="button"
            onClick={() => setUsageFilter("all")}
          >
            {usageLabels.all}
          </button>
          {search ? <button className="ghost-button" type="button" onClick={() => setSearch("")}>{t("清除")}</button> : null}
        </div>
      </section>

      <div className="desktop-catalog-sections">
        {sections.map((section) => {
          const usageVisibleItems = filterCatalogItems(section.items, usageFilter, search);
          if (section.kind === "genres") {
            const facetVisibleItems = filterGenreFacetItems(usageVisibleItems, genreFacet);
            const facetGroups = genreFacet === "all" ? groupGenreItemsByPrimaryFacet(facetVisibleItems) : [];
            const hasOtherGenres = section.items.some((item) => !item.genreFacets?.length);
            return (
              <section className="settings-card" key={section.kind}>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">{section.eyebrow}</span>
                    <h2>{section.title}</h2>
                    <small className="muted">{genreFacetDescription(uiLanguage)}</small>
                  </div>
                  <small className="muted">
                    {t("{count} 项", { count: facetVisibleItems.length })} / {t("{count} 项", { count: section.items.length })}
                  </small>
                </div>
                <div className="button-row" aria-label={genreFacetAriaLabel(uiLanguage)}>
                  {(["all", ...GENRE_FACET_ORDER, ...(hasOtherGenres ? ["other" as const] : [])] as GenreFacetFilter[]).map((facet) => (
                    <button
                      className={genreFacet === facet ? "primary-button" : "ghost-button"}
                      key={facet}
                      type="button"
                      onClick={() => setGenreFacet(facet)}
                    >
                      {genreFacetLabel(facet, uiLanguage)}
                    </button>
                  ))}
                </div>
                {facetVisibleItems.length ? (
                  genreFacet === "all" ? (
                    <div className="page-stack">
                      {facetGroups.map((group) => (
                        <div key={group.facet}>
                          <div className="section-heading">
                            <div><h3>{genreFacetLabel(group.facet, uiLanguage)}</h3></div>
                            <small className="muted">
                              {t("{count} 项", { count: group.items.length })}
                            </small>
                          </div>
                          <CatalogItemGrid
                            items={group.items}
                            onSelect={(id) => setSelection({ kind: "genres", id })}
                            workCountLabel={(count) => t("{count} 部作品", { count })}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <CatalogItemGrid
                      items={facetVisibleItems}
                      onSelect={(id) => setSelection({ kind: "genres", id })}
                      workCountLabel={(count) => t("{count} 部作品", { count })}
                    />
                  )
                ) : <p className="muted">{t("暂无数据。")}</p>}
              </section>
            );
          }

          return (
            <section className="settings-card" key={section.kind}>
              <div className="section-heading">
                <div><span className="eyebrow">{section.eyebrow}</span><h2>{section.title}</h2></div>
                <small className="muted">
                  {t("{count} 项", { count: usageVisibleItems.length })} / {t("{count} 项", { count: section.items.length })}
                </small>
              </div>
              {usageVisibleItems.length ? (
                <CatalogItemGrid
                  items={usageVisibleItems}
                  onSelect={(id) => setSelection({ kind: section.kind, id })}
                  workCountLabel={(count) => t("{count} 部作品", { count })}
                />
              ) : <p className="muted">{t("暂无数据。")}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function catalogUsageLabels(language: SupportedLanguage): Record<CatalogUsageFilter, string> {
  if (language === "ja") {
    return { used: "作品あり", unused: "作品なし", all: "すべて" };
  }
  if (language === "en") {
    return { used: "With works", unused: "Without works", all: "All" };
  }
  return { used: "有作品", unused: "无作品", all: "全部" };
}

function catalogQuery(selection: CatalogSelection): WorkQuery {
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

function catalogTitle(kind: CatalogKind): string {
  return ({ makers: "maker", labels: "label", series: "series", genres: "genre", directors: "director", workTypes: "work type", tags: "tag" } as const)[kind];
}

function catalogEntityItem(
  id: string,
  names: LocalizedText,
  metadataLanguage: SupportedLanguage,
  count: number,
): CatalogItem {
  return {
    id,
    label: localizeText(names, metadataLanguage, id),
    count,
    searchValues: [id, ...Object.values(names).filter((value): value is string => Boolean(value))],
  };
}

function mergeCatalogItems(primary: CatalogItem[], secondary: CatalogItem[]): CatalogItem[] {
  const byId = new Map(primary.map((item) => [item.id, item]));
  for (const item of secondary) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    byId.set(item.id, {
      ...existing,
      count: Math.max(existing.count, item.count),
      searchValues: uniqueSearchValues([...existing.searchValues, ...item.searchValues]),
      genreFacets: existing.genreFacets ?? item.genreFacets,
    });
  }
  return [...byId.values()].sort(catalogSort);
}

function CatalogItemGrid({
  items,
  onSelect,
  workCountLabel,
}: {
  items: CatalogItem[];
  onSelect: (id: string) => void;
  workCountLabel: (count: number) => string;
}) {
  return (
    <div className="desktop-catalog-grid">
      {items.map((item) => (
        <button key={item.id} onClick={() => onSelect(item.id)} type="button">
          <strong>{item.label}</strong>
          <small>{workCountLabel(item.count)}</small>
        </button>
      ))}
    </div>
  );
}

function filterGenreFacetItems(items: CatalogItem[], facet: GenreFacetFilter): CatalogItem[] {
  if (facet === "all") return items;
  if (facet === "other") return items.filter((item) => !item.genreFacets?.length);
  return items.filter((item) => item.genreFacets?.includes(facet));
}

function groupGenreItemsByPrimaryFacet(items: CatalogItem[]): Array<{ facet: GenreFacetFilter; items: CatalogItem[] }> {
  const groups = new Map<GenreFacetFilter, CatalogItem[]>();
  for (const item of items) {
    const facet: GenreFacetFilter = item.genreFacets?.[0] ?? "other";
    const group = groups.get(facet) ?? [];
    group.push(item);
    groups.set(facet, group);
  }
  return [...GENRE_FACET_ORDER, "other" as const]
    .map((facet) => ({ facet, items: groups.get(facet) ?? [] }))
    .filter((group) => group.items.length > 0);
}

function genreFacetLabel(facet: GenreFacetFilter, language: SupportedLanguage): string {
  const labels: Record<GenreFacetFilter, Record<SupportedLanguage, string>> = {
    all: { "zh-CN": "全部分组", ja: "すべての分類", en: "All groups" },
    theme: { "zh-CN": "主题", ja: "テーマ", en: "Theme" },
    role: { "zh-CN": "角色", ja: "役割", en: "Role" },
    wardrobe: { "zh-CN": "服装", ja: "衣装", en: "Wardrobe" },
    body: { "zh-CN": "体型与外观", ja: "体型・外見", en: "Body & Appearance" },
    act: { "zh-CN": "行为", ja: "行為", en: "Act" },
    practice: { "zh-CN": "玩法与偏好", ja: "プレイ・嗜好", en: "Practice & Fetish" },
    other: { "zh-CN": "其他 / 自定义", ja: "その他 / カスタム", en: "Other / Custom" },
  };
  return labels[facet][language];
}

function genreFacetDescription(language: SupportedLanguage): string {
  if (language === "ja") return "すべて表示では主分類ごとに一度だけ配置し、個別分類では兼属する Genre も含めます。作品タイプや媒体属性は別ディメンションです。";
  if (language === "en") return "All groups place each Genre once by its primary facet; a specific facet also includes Genres that belong to multiple facets. Work types and media attributes remain separate.";
  return "全部分组按主分面各显示一次；切换具体分面时也会包含兼属该分面的 Genre。作品类型与媒介属性保持独立。";
}

function genreFacetAriaLabel(language: SupportedLanguage): string {
  if (language === "ja") return "Genre 分類フィルター";
  if (language === "en") return "Genre facet filter";
  return "Genre 分组筛选";
}

function filterCatalogItems(items: CatalogItem[], usageFilter: CatalogUsageFilter, search: string): CatalogItem[] {
  const query = normalizeSearch(search);
  return items.filter((item) => {
    if (usageFilter === "used" && item.count <= 0) return false;
    if (usageFilter === "unused" && item.count > 0) return false;
    if (!query) return true;
    return item.searchValues.some((value) => normalizeSearch(value).includes(query));
  });
}

function uniqueSearchValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function facetCount(
  result: WorkSearchResult,
  key: "makers" | "labels" | "series" | "genres" | "workTypes" | "tags",
  id: string,
): number {
  return result.facets[key].find((facet) => facet.id === id)?.count ?? 0;
}

function catalogSort(a: CatalogItem, b: CatalogItem): number {
  return b.count - a.count || a.label.localeCompare(b.label, "ja");
}

function BrowserState({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={error ? "empty-state desktop-explorer-state error-state" : "empty-state desktop-explorer-state"}>{children}</div>;
}

function useAsyncCatalogData<T>(factory: () => Promise<T>, dependencies: readonly unknown[]) {
  return useStableAsyncData(factory, dependencies, (error) => error instanceof Error ? error.message : String(error));
}
