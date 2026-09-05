import { useState, type ReactNode } from "react";

import {
  getPreferredPersonName,
  localizeText,
} from "@/application/services/localization-service";
import { localizeGenre } from "@/application/services/genre-localization-service";
import {
  COMMUNITY_ORGANIZATION_CATALOG,
  COMMUNITY_SERIES_CATALOG,
} from "@/application/catalog/community-entity-catalog";
import {
  CONTROLLED_GENRE_DEFINITIONS,
  WORK_TYPE_DEFINITIONS,
} from "@/application/importers/import-classification-normalizer";
import type { WorkSearchResult } from "@/domain/queries/work-query";
import type { LocalizedText, SupportedLanguage } from "@/domain/value-objects/localized-text";
import { DesktopWorkExplorer } from "./desktop-work-explorer";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { useDesktopI18n } from "./desktop-i18n";
import { useStableAsyncData } from "./use-stable-async-data";
import { catalogCommunityDescription, catalogQuery, catalogTitle, catalogUsageLabels, filterCatalogItems, filterGenreFacetItems, GENRE_FACET_ORDER, genreFacetAriaLabel, genreFacetDescription, genreFacetLabel, groupGenreItemsByPrimaryFacet, type CatalogItem, type CatalogKind, type CatalogSelection, type CatalogUsageFilter, type GenreFacetFilter } from "./desktop-catalog-model";

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
    const organizationById = new Map<string, { id: string; kind: string; names: LocalizedText }>();
    for (const item of COMMUNITY_ORGANIZATION_CATALOG) organizationById.set(item.id, item);
    for (const item of organizations) organizationById.set(item.id, item);
    const parentSubtitle = (parentOrganizationId?: string) =>
      catalogParentSubtitle(parentOrganizationId, organizationById, metadataLanguage, uiLanguage);

    const controlledGenres = CONTROLLED_GENRE_DEFINITIONS.map((item) => ({
      id: item.id,
      label: localizeText(item.names, metadataLanguage, item.id),
      sortKey: stableLocalizedSortKey(item.names, item.id),
      count: facetCount(result, "genres", item.id),
      searchValues: uniqueSearchValues([item.id, ...Object.values(item.names), ...item.aliases].filter((value): value is string => Boolean(value))),
      genreFacets: item.facets,
    }));
    const libraryGenreItems = libraryGenres.map((item) => ({
      id: item.id,
      label: localizeGenre(item, metadataLanguage, item.id),
      sortKey: stableLocalizedSortKey(item.names, item.id),
      count: facetCount(result, "genres", item.id),
      searchValues: uniqueSearchValues(
        [item.id, ...Object.values(item.names)].filter((value): value is string => Boolean(value)),
      ),
    }));
    const controlledWorkTypes = WORK_TYPE_DEFINITIONS.map((item) => ({
      id: item.id,
      label: localizeText(item.names, metadataLanguage, item.id),
      sortKey: stableLocalizedSortKey(item.names, item.id),
      count: facetCount(result, "workTypes", item.id),
      searchValues: uniqueSearchValues([item.id, ...Object.values(item.names), ...item.aliases].filter((value): value is string => Boolean(value))),
    }));
    const facetWorkTypes = result.facets.workTypes.map((facet) => ({
      id: facet.id,
      label: facet.id,
      sortKey: facet.id,
      count: facet.count,
      searchValues: [facet.id],
    }));

    return {
      makers: mergeCatalogItems(
        organizations
          .filter((item) => item.kind === "maker")
          .map((item) => catalogEntityItem(item.id, item.names, metadataLanguage, facetCount(result, "makers", item.id), [], parentSubtitle(item.parentOrganizationId))),
        COMMUNITY_ORGANIZATION_CATALOG
          .filter((item) => item.kind === "maker")
          .map((item) => catalogEntityItem(item.id, item.names, metadataLanguage, facetCount(result, "makers", item.id), item.aliases, parentSubtitle(item.parentOrganizationId))),
      ),
      labels: mergeCatalogItems(
        organizations
          .filter((item) => item.kind === "label")
          .map((item) => catalogEntityItem(item.id, item.names, metadataLanguage, facetCount(result, "labels", item.id), [], parentSubtitle(item.parentOrganizationId))),
        COMMUNITY_ORGANIZATION_CATALOG
          .filter((item) => item.kind === "label")
          .map((item) => catalogEntityItem(item.id, item.names, metadataLanguage, facetCount(result, "labels", item.id), item.aliases, parentSubtitle(item.parentOrganizationId))),
      ),
      series: mergeCatalogItems(
        series.map((item) => catalogEntityItem(item.id, item.names, metadataLanguage, facetCount(result, "series", item.id), [], parentSubtitle(item.parentOrganizationId))),
        COMMUNITY_SERIES_CATALOG.map((item) =>
          catalogEntityItem(item.id, item.names, metadataLanguage, facetCount(result, "series", item.id), item.aliases, parentSubtitle(item.parentOrganizationId)),
        ),
      ),
      genres: mergeCatalogItems(controlledGenres, libraryGenreItems),
      tags: tags
        .map((item) => catalogEntityItem(item.id, item.names, metadataLanguage, facetCount(result, "tags", item.id)))
        .sort(catalogSort),
      directors: result.facets.directors.map((facet) => ({
        id: facet.id,
        label: peopleById.has(facet.id) ? getPreferredPersonName(peopleById.get(facet.id)!, metadataLanguage) : facet.id,
        sortKey: facet.id,
        count: facet.count,
        searchValues: [facet.id, peopleById.has(facet.id) ? getPreferredPersonName(peopleById.get(facet.id)!, metadataLanguage) : facet.id],
      })).sort(catalogSort),
      workTypes: mergeCatalogItems(controlledWorkTypes, facetWorkTypes),
    };
  }, [repository, metadataLanguage, uiLanguage]);

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
        <p>{catalogCommunityDescription(uiLanguage)}</p>
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
                <div className="button-row catalog-genre-facet-toolbar" aria-label={genreFacetAriaLabel(uiLanguage)}>
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


function catalogEntityItem(
  id: string,
  names: LocalizedText,
  metadataLanguage: SupportedLanguage,
  count: number,
  aliases: readonly string[] = [],
  subtitle?: string,
): CatalogItem {
  return {
    id,
    label: localizeText(names, metadataLanguage, id),
    sortKey: stableLocalizedSortKey(names, id),
    count,
    subtitle,
    searchValues: uniqueSearchValues([
      id,
      ...Object.values(names).filter((value): value is string => Boolean(value)),
      ...aliases,
      ...(subtitle ? [subtitle] : []),
    ]),
  };
}

function catalogParentSubtitle(
  parentOrganizationId: string | undefined,
  organizationById: Map<string, { id: string; kind: string; names: LocalizedText }>,
  metadataLanguage: SupportedLanguage,
  uiLanguage: SupportedLanguage,
): string | undefined {
  if (!parentOrganizationId) return undefined;
  const parent = organizationById.get(parentOrganizationId);
  if (!parent || (parent.kind !== "maker" && parent.kind !== "label")) return undefined;
  const kindLabel = parent.kind === "maker"
    ? ({ "zh-CN": "厂商", ja: "メーカー", en: "Maker" } as const)[uiLanguage]
    : ({ "zh-CN": "厂牌", ja: "レーベル", en: "Label" } as const)[uiLanguage];
  return `${kindLabel} · ${localizeText(parent.names, metadataLanguage, parent.id)}`;
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
      subtitle: existing.subtitle ?? item.subtitle,
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
          {item.subtitle ? <small className="muted">{item.subtitle}</small> : null}
          <small>{workCountLabel(item.count)}</small>
        </button>
      ))}
    </div>
  );
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

function stableLocalizedSortKey(names: LocalizedText, id: string): string {
  return names.ja ?? names["zh-CN"] ?? names.en ?? id;
}

function catalogSort(a: CatalogItem, b: CatalogItem): number {
  return b.count - a.count
    || a.sortKey.localeCompare(b.sortKey, "ja")
    || a.id.localeCompare(b.id, "en");
}

function BrowserState({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={error ? "empty-state desktop-explorer-state error-state" : "empty-state desktop-explorer-state"}>{children}</div>;
}

function useAsyncCatalogData<T>(factory: () => Promise<T>, dependencies: readonly unknown[]) {
  return useStableAsyncData(factory, dependencies, (error) => error instanceof Error ? error.message : String(error));
}
