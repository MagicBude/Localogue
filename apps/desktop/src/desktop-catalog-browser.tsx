import { useState, type ReactNode } from "react";

import {
  getPreferredPersonName,
  localizeText,
} from "@/application/services/localization-service";
import { localizeGenre } from "@/application/services/genre-localization-service";
import { workTypeDefinition } from "@/application/importers/import-classification-normalizer";
import type { WorkQuery, WorkSearchResult } from "@/domain/queries/work-query";

import { DesktopWorkExplorer } from "./desktop-work-explorer";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { useDesktopI18n } from "./desktop-i18n";
import { useStableAsyncData } from "./use-stable-async-data";

type CatalogKind = "makers" | "labels" | "series" | "genres" | "directors" | "workTypes" | "tags";

interface CatalogSelection {
  kind: CatalogKind;
  id: string;
}

interface CatalogItem {
  id: string;
  label: string;
  count: number;
}

export function DesktopCatalogBrowser({
  repository,
  openWork,
}: {
  repository: TauriLibraryRepository;
  openWork: (id: string) => void;
}) {
  const { t, metadataLanguage } = useDesktopI18n();
  const [selection, setSelection] = useState<CatalogSelection | null>(null);
  const data = useAsyncCatalogData(async () => {
    const [result, organizations, series, genres, tags, people] = await Promise.all([
      repository.listWorks({ page: 1, pageSize: 1 }),
      repository.listOrganizations(),
      repository.listSeries(),
      repository.listGenres(),
      repository.listTags(),
      repository.listPeople({ page: 1, pageSize: 100000 }),
    ]);
    const peopleById = new Map(people.items.map((person) => [person.id, person]));
    return {
      makers: organizations.filter((item) => item.kind === "maker").map((item) => ({ id: item.id, label: localizeText(item.names, metadataLanguage, item.id), count: facetCount(result, "makers", item.id) })).filter(hasCount).sort(catalogSort),
      labels: organizations.filter((item) => item.kind === "label").map((item) => ({ id: item.id, label: localizeText(item.names, metadataLanguage, item.id), count: facetCount(result, "labels", item.id) })).filter(hasCount).sort(catalogSort),
      series: series.map((item) => ({ id: item.id, label: localizeText(item.names, metadataLanguage, item.id), count: facetCount(result, "series", item.id) })).filter(hasCount).sort(catalogSort),
      genres: genres.map((item) => ({ id: item.id, label: localizeGenre(item, metadataLanguage, item.id), count: facetCount(result, "genres", item.id) })).filter(hasCount).sort(catalogSort),
      tags: tags.map((item) => ({ id: item.id, label: localizeText(item.names, metadataLanguage, item.id), count: facetCount(result, "tags", item.id) })).filter(hasCount).sort(catalogSort),
      directors: result.facets.directors.map((facet) => ({ id: facet.id, label: peopleById.has(facet.id) ? getPreferredPersonName(peopleById.get(facet.id)!, metadataLanguage) : facet.id, count: facet.count })).sort(catalogSort),
      workTypes: result.facets.workTypes.map((facet) => ({ id: facet.id, label: workTypeDefinition(facet.id) ? localizeText(workTypeDefinition(facet.id)!.names, metadataLanguage, facet.id) : friendlyId(facet.id), count: facet.count })).sort(catalogSort),
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
    { kind: "makers", title: t("厂商"), eyebrow: "MAKERS", items: data.value.makers },
    { kind: "labels", title: t("厂牌"), eyebrow: "LABELS", items: data.value.labels },
    { kind: "series", title: t("系列"), eyebrow: "SERIES", items: data.value.series },
    { kind: "genres", title: t("题材"), eyebrow: "GENRES", items: data.value.genres },
    { kind: "directors", title: t("导演"), eyebrow: "DIRECTORS", items: data.value.directors },
    { kind: "workTypes", title: t("作品类型"), eyebrow: "WORK TYPES", items: data.value.workTypes },
    { kind: "tags", title: t("标签"), eyebrow: "TAGS", items: data.value.tags },
  ];

  return (
    <div className="page-stack">
      <section className="page-title">
        <span className="eyebrow">EXPLORE · CATALOG INDEX</span>
        <h1>{t("分类浏览")}</h1>
        <p>{t("对齐 Web 的厂商、厂牌、系列、Genre、导演、作品类型和 Tag 索引；点击任意分类后继续使用完整作品多维筛选。")}</p>
      </section>
      <div className="desktop-catalog-sections">
        {sections.map((section) => (
          <section className="settings-card" key={section.kind}>
            <div className="section-heading"><div><span className="eyebrow">{section.eyebrow}</span><h2>{section.title}</h2></div><small className="muted">{t("{count} 项", { count: section.items.length })}</small></div>
            {section.items.length ? (
              <div className="desktop-catalog-grid">
                {section.items.slice(0, 120).map((item) => (
                  <button key={item.id} onClick={() => setSelection({ kind: section.kind, id: item.id })} type="button">
                    <strong>{item.label}</strong><small>{t("{count} 部作品", { count: item.count })}</small>
                  </button>
                ))}
              </div>
            ) : <p className="muted">{t("当前资料源没有这个维度的数据。")}</p>}
          </section>
        ))}
      </div>
    </div>
  );
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

function facetCount(result: WorkSearchResult, key: "makers" | "labels" | "series" | "genres" | "tags", id: string): number {
  return result.facets[key].find((facet) => facet.id === id)?.count ?? 0;
}

function hasCount(item: CatalogItem): boolean { return item.count > 0; }
function catalogSort(a: CatalogItem, b: CatalogItem): number { return b.count - a.count || a.label.localeCompare(b.label, "ja"); }
function friendlyId(value: string): string { return value.replace(/^work[-_]?type[-_:]?/i, "").replace(/[-_]/g, " ") || value; }

function BrowserState({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={error ? "empty-state desktop-explorer-state error-state" : "empty-state desktop-explorer-state"}>{children}</div>;
}

function useAsyncCatalogData<T>(factory: () => Promise<T>, dependencies: readonly unknown[]) {
  return useStableAsyncData(factory, dependencies, (error) => error instanceof Error ? error.message : String(error));
}
