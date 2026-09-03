import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import {
  getPreferredPersonName,
  localizeText,
} from "@/application/services/localization-service";
import type { WorkQuery, WorkSearchResult, WorkSort } from "@/domain/queries/work-query";

import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { useDesktopI18n } from "./desktop-i18n";
import {
  buildDesktopWorkCards,
  DesktopWorkResults,
  DesktopWorkViewSwitcher,
  type DesktopWorkViewMode,
} from "./desktop-work-results";

interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

interface ExplorerData {
  result: WorkSearchResult;
  cards: ReturnType<typeof buildDesktopWorkCards>;
  people: FilterOption[];
  directors: FilterOption[];
  makers: FilterOption[];
  labels: FilterOption[];
  series: FilterOption[];
  genres: FilterOption[];
  tags: FilterOption[];
  workTypes: FilterOption[];
  years: FilterOption[];
}

export function DesktopWorkExplorer({
  repository,
  onOpen,
  fixedPersonId,
  pageSize = 24,
  storageKey = "localogue.desktop.work-view",
  initialQuery,
}: {
  repository: TauriLibraryRepository;
  onOpen: (id: string) => void;
  fixedPersonId?: string;
  pageSize?: number;
  storageKey?: string;
  initialQuery?: WorkQuery;
}) {
  const { t, metadataLanguage } = useDesktopI18n();
  const [query, setQuery] = useState<WorkQuery>(() => ({ sort: "release_desc", ...initialQuery }));
  const [page, setPage] = useState(1);
  const [view, setView] = useState<DesktopWorkViewMode>(() => {
    const saved = window.localStorage.getItem(storageKey);
    return saved === "list" || saved === "table" ? saved : "grid";
  });

  useEffect(() => setPage(1), [query, fixedPersonId]);

  const data = useAsyncExplorerData(async () => {
    const effectiveQuery: WorkQuery = {
      ...query,
      ...(fixedPersonId ? { personIds: [fixedPersonId] } : {}),
      page,
      pageSize,
    };
    const result = await repository.listWorks(effectiveQuery);
    const [peopleResult, organizations, series, genres, tags, assets] = await Promise.all([
      repository.listPeople({ page: 1, pageSize: 100000 }),
      repository.listOrganizations(),
      repository.listSeries(),
      repository.listGenres(),
      repository.listTags(),
      repository.listAssets(),
    ]);

    const peopleById = new Map(peopleResult.items.map((item) => [item.id, item]));
    const performerIds = new Set(result.facets.people.map((item) => item.id));
    const directorIds = new Set(result.facets.directors.map((item) => item.id));
    for (const id of query.personIds ?? []) performerIds.add(id);
    for (const id of query.directorIds ?? []) directorIds.add(id);

    const optionForPerson = (id: string, count: number | undefined): FilterOption => ({
      id,
      label: peopleById.has(id)
        ? getPreferredPersonName(peopleById.get(id)!, metadataLanguage)
        : id,
      count,
    });

    const people = [...performerIds]
      .map((id) => optionForPerson(id, result.facets.people.find((facet) => facet.id === id)?.count))
      .sort(optionSort);
    const directors = [...directorIds]
      .map((id) => optionForPerson(id, result.facets.directors.find((facet) => facet.id === id)?.count))
      .sort(optionSort);

    const makers = organizations
      .filter((item) => item.kind === "maker")
      .map((item) => ({
        id: item.id,
        label: localizeText(item.names, metadataLanguage, item.id),
        count: result.facets.makers.find((facet) => facet.id === item.id)?.count ?? 0,
      }))
      .filter((item) => item.count > 0 || query.makerIds?.includes(item.id))
      .sort(optionSort);

    const labels = organizations
      .filter((item) => item.kind === "label")
      .map((item) => ({
        id: item.id,
        label: localizeText(item.names, metadataLanguage, item.id),
        count: result.facets.labels.find((facet) => facet.id === item.id)?.count ?? 0,
      }))
      .filter((item) => item.count > 0 || query.labelIds?.includes(item.id))
      .sort(optionSort);

    const seriesOptions = series
      .map((item) => ({
        id: item.id,
        label: localizeText(item.names, metadataLanguage, item.id),
        count: result.facets.series.find((facet) => facet.id === item.id)?.count ?? 0,
      }))
      .filter((item) => item.count > 0 || query.seriesIds?.includes(item.id))
      .sort(optionSort);

    const genreOptions = genres
      .map((item) => ({
        id: item.id,
        label: localizeText(item.names, metadataLanguage, item.id),
        count: result.facets.genres.find((facet) => facet.id === item.id)?.count ?? 0,
      }))
      .filter((item) => item.count > 0 || query.genreIds?.includes(item.id))
      .sort(optionSort);

    const tagOptions = tags
      .map((item) => ({
        id: item.id,
        label: localizeText(item.names, metadataLanguage, item.id),
        count: result.facets.tags.find((facet) => facet.id === item.id)?.count ?? 0,
      }))
      .filter((item) => item.count > 0 || query.tagIds?.includes(item.id))
      .sort(optionSort);

    const workTypeIds = new Set([
      ...result.facets.workTypes.map((facet) => facet.id),
      ...(query.workTypeIds ?? []),
    ]);
    const workTypes = [...workTypeIds]
      .map((id) => ({
        id,
        label: friendlyId(id),
        count: result.facets.workTypes.find((facet) => facet.id === id)?.count ?? 0,
      }))
      .sort(optionSort);

    const years = result.facets.years.map((facet) => ({
      id: facet.id,
      label: facet.id,
      count: facet.count,
    }));

    return {
      result,
      cards: buildDesktopWorkCards(result.items, peopleResult.items, organizations, assets, metadataLanguage),
      people,
      directors,
      makers,
      labels,
      series: seriesOptions,
      genres: genreOptions,
      tags: tagOptions,
      workTypes,
      years,
    };
  }, [repository, query, page, pageSize, fixedPersonId, metadataLanguage]);

  function changeView(next: DesktopWorkViewMode): void {
    setView(next);
    window.localStorage.setItem(storageKey, next);
  }

  if (data.loading) return <ExplorerState>{t("正在读取作品与 Facet…")}</ExplorerState>;
  if (data.error || !data.value) return <ExplorerState error>{data.error ?? t("无法读取作品。")}</ExplorerState>;

  const { result, cards } = data.value;
  const pageCount = Math.max(1, Math.ceil(result.total / pageSize));

  return (
    <div className="desktop-library-layout">
      <WorkFacetPanel
        query={query}
        onChange={setQuery}
        fixedPersonId={fixedPersonId}
        data={data.value}
      />

      <section className="desktop-results-panel">
        <DesktopWorkFilterChips query={query} data={data.value} onChange={setQuery} />
        <div className="desktop-results-toolbar">
          <div className="result-meta">
            {t("{count} 项作品 · 第 {page} / {pages} 页", { count: result.total, page: result.page, pages: pageCount })}
          </div>
          <DesktopWorkViewSwitcher current={view} onChange={changeView} />
        </div>
        <DesktopWorkResults cards={cards} view={view} onOpen={onOpen} />
        {!cards.length ? <ExplorerState>{t("没有符合当前筛选条件的作品。")}</ExplorerState> : null}
        {result.total > pageSize ? (
          <div className="desktop-pagination" aria-label={t("分页")}>
            <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← {t("上一页")}</button>
            <span>{page} / {pageCount}</span>
            <button disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>{t("下一页")} →</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function WorkFacetPanel({
  query,
  onChange,
  fixedPersonId,
  data,
}: {
  query: WorkQuery;
  onChange: (query: WorkQuery) => void;
  fixedPersonId?: string;
  data: ExplorerData;
}) {
  const { t } = useDesktopI18n();
  const patch = (next: Partial<WorkQuery>) => onChange({ ...query, ...next });
  return (
    <aside className="desktop-facet-panel">
      <div className="desktop-facet-panel__heading">
        <div><strong>{t("多维筛选")}</strong><small>{t("与 Web 共用 WorkQuery / Facet 规则")}</small></div>
        <button type="button" onClick={() => onChange({ sort: "release_desc" })}>{t("清除")}</button>
      </div>

      <label className="field">
        <span>{t("搜索番号或标题")}</span>
        <input
          value={query.text ?? ""}
          onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ text: event.target.value || undefined })}
          placeholder={t("例如 MIDV-077 / 标题")}
          type="search"
        />
      </label>

      <label className="field">
        <span>{t("排序")}</span>
        <select value={query.sort ?? "release_desc"} onChange={(event) => patch({ sort: event.target.value as WorkSort })}>
          <option value="release_desc">{t("发行日期")} ↓</option>
          <option value="release_asc">{t("发行日期")} ↑</option>
          <option value="duration_desc">{t("时长")} ↓</option>
          <option value="duration_asc">{t("时长")} ↑</option>
          <option value="code_asc">{t("番号")} A → Z</option>
          <option value="code_desc">{t("番号")} Z → A</option>
          <option value="title_asc">{t("标题")} A → Z</option>
          <option value="title_desc">{t("标题")} Z → A</option>
          <option value="created_desc">{t("最近创建")}</option>
          <option value="updated_desc">{t("最近更新")}</option>
        </select>
      </label>

      <div className="desktop-filter-pair">
        <label className="field"><span>{t("发行日期")} ≥</span><input value={query.releaseFrom ?? ""} onChange={(event) => patch({ releaseFrom: event.target.value || undefined })} type="date" /></label>
        <label className="field"><span>{t("发行日期")} ≤</span><input value={query.releaseTo ?? ""} onChange={(event) => patch({ releaseTo: event.target.value || undefined })} type="date" /></label>
      </div>
      <div className="desktop-filter-pair">
        <label className="field"><span>{t("时长")} ≥</span><input min="0" value={query.durationMin ?? ""} onChange={(event) => patch({ durationMin: parseOptionalNumber(event.target.value) })} placeholder="90" type="number" /></label>
        <label className="field"><span>{t("时长")} ≤</span><input min="0" value={query.durationMax ?? ""} onChange={(event) => patch({ durationMax: parseOptionalNumber(event.target.value) })} placeholder="180" type="number" /></label>
      </div>
      <div className="desktop-filter-pair">
        <BooleanSelect label={t("有封面")} value={query.hasCover} onChange={(value) => patch({ hasCover: value })} />
        <BooleanSelect label={t("有本地媒体")} value={query.hasMedia} onChange={(value) => patch({ hasMedia: value })} />
      </div>

      {!fixedPersonId ? <FilterGroup label={t("演员")} values={query.personIds} options={data.people} onChange={(values) => patch({ personIds: values.length ? values : undefined })} /> : null}
      <FilterGroup label={t("导演")} values={query.directorIds} options={data.directors} onChange={(values) => patch({ directorIds: values.length ? values : undefined })} />
      <FilterGroup label={t("年份")} values={query.releaseYears} options={data.years} onChange={(values) => patch({ releaseYears: values.length ? values : undefined })} />
      <FilterGroup label={t("作品类型")} values={query.workTypeIds} options={data.workTypes} onChange={(values) => patch({ workTypeIds: values.length ? values : undefined })} />
      <FilterGroup label={t("厂商")} values={query.makerIds} options={data.makers} onChange={(values) => patch({ makerIds: values.length ? values : undefined })} />
      <FilterGroup label={t("厂牌")} values={query.labelIds} options={data.labels} onChange={(values) => patch({ labelIds: values.length ? values : undefined })} />
      <FilterGroup label={t("系列")} values={query.seriesIds} options={data.series} onChange={(values) => patch({ seriesIds: values.length ? values : undefined })} />
      <FilterGroup label={t("Genre")} values={query.genreIds} options={data.genres} onChange={(values) => patch({ genreIds: values.length ? values : undefined })} />
      <FilterGroup label={t("Tag")} values={query.tagIds} options={data.tags} onChange={(values) => patch({ tagIds: values.length ? values : undefined })} />
    </aside>
  );
}

function DesktopWorkFilterChips({
  query,
  data,
  onChange,
}: {
  query: WorkQuery;
  data: ExplorerData;
  onChange: (query: WorkQuery) => void;
}) {
  const { t } = useDesktopI18n();
  const maps = useMemo(() => ({
    personIds: toOptionMap(data.people),
    directorIds: toOptionMap(data.directors),
    makerIds: toOptionMap(data.makers),
    labelIds: toOptionMap(data.labels),
    seriesIds: toOptionMap(data.series),
    genreIds: toOptionMap(data.genres),
    workTypeIds: toOptionMap(data.workTypes),
    tagIds: toOptionMap(data.tags),
    releaseYears: toOptionMap(data.years),
  }), [data]);

  const chips: Array<{ key: keyof WorkQuery; value?: string; label: string }> = [];
  if (query.text) chips.push({ key: "text", label: `${t("关键词")}：${query.text}` });
  pushArrayChips(chips, "personIds", t("演员"), query.personIds, maps.personIds);
  pushArrayChips(chips, "directorIds", t("导演"), query.directorIds, maps.directorIds);
  pushArrayChips(chips, "makerIds", t("厂商"), query.makerIds, maps.makerIds);
  pushArrayChips(chips, "labelIds", t("厂牌"), query.labelIds, maps.labelIds);
  pushArrayChips(chips, "seriesIds", t("系列"), query.seriesIds, maps.seriesIds);
  pushArrayChips(chips, "genreIds", "Genre", query.genreIds, maps.genreIds);
  pushArrayChips(chips, "workTypeIds", t("类型"), query.workTypeIds, maps.workTypeIds);
  pushArrayChips(chips, "tagIds", "Tag", query.tagIds, maps.tagIds);
  pushArrayChips(chips, "releaseYears", t("年份"), query.releaseYears, maps.releaseYears);
  if (query.releaseFrom) chips.push({ key: "releaseFrom", label: `${t("发行日期")} ≥ ${query.releaseFrom}` });
  if (query.releaseTo) chips.push({ key: "releaseTo", label: `${t("发行日期")} ≤ ${query.releaseTo}` });
  if (query.durationMin !== undefined) chips.push({ key: "durationMin", label: `${t("时长")} ≥ ${query.durationMin}` });
  if (query.durationMax !== undefined) chips.push({ key: "durationMax", label: `${t("时长")} ≤ ${query.durationMax}` });
  if (query.hasCover !== undefined) chips.push({ key: "hasCover", label: `${t("封面")}：${query.hasCover ? t("是") : t("否")}` });
  if (query.hasMedia !== undefined) chips.push({ key: "hasMedia", label: `${t("媒体")}：${query.hasMedia ? t("是") : t("否")}` });

  if (!chips.length) return null;
  return (
    <div className="desktop-active-filters">
      <strong>{t("已选筛选")}</strong>
      <div>
        {chips.map((chip) => (
          <button
            type="button"
            key={`${String(chip.key)}-${chip.value ?? chip.label}`}
            onClick={() => onChange(removeChip(query, chip.key, chip.value))}
          >
            {chip.label} ×
          </button>
        ))}
      </div>
    </div>
  );
}

function BooleanSelect({ label, value, onChange }: { label: string; value?: boolean; onChange: (value?: boolean) => void }) {
  const { t } = useDesktopI18n();
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value === undefined ? "" : String(value)} onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value === "true")}>
        <option value="">{t("任意")}</option>
        <option value="true">{t("是")}</option>
        <option value="false">{t("否")}</option>
      </select>
    </label>
  );
}

function FilterGroup({
  label,
  options,
  values = [],
  onChange,
}: {
  label: string;
  options: FilterOption[];
  values?: string[];
  onChange: (values: string[]) => void;
}) {
  const { t } = useDesktopI18n();
  if (!options.length && !values.length) return null;
  const ordered = [...options].sort((a, b) => Number(values.includes(b.id)) - Number(values.includes(a.id)) || optionSort(a, b));
  return (
    <details className="desktop-facet-group" open={values.length > 0}>
      <summary><span>{label}</span><small>{values.length ? t("已选 {count}", { count: values.length }) : t("{count} 项", { count: options.length })}</small></summary>
      <div className="desktop-facet-options">
        {ordered.slice(0, 80).map((option) => (
          <label key={option.id}>
            <input
              checked={values.includes(option.id)}
              onChange={() => onChange(toggleValue(values, option.id))}
              type="checkbox"
            />
            <span title={option.id}>{option.label}</span>
            <small>{option.count ?? 0}</small>
          </label>
        ))}
      </div>
      {ordered.length > 80 ? <small className="muted">{t("当前显示前 80 项；可先组合其他维度缩小范围。")}</small> : null}
    </details>
  );
}

function ExplorerState({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={error ? "empty-state desktop-explorer-state error-state" : "empty-state desktop-explorer-state"}>{children}</div>;
}

function useAsyncExplorerData<T>(factory: () => Promise<T>, dependencies: readonly unknown[]) {
  const [state, setState] = useState<{ loading: boolean; value?: T; error?: string }>({ loading: true });
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    let disposed = false;
    setState((current) => ({ ...current, loading: true, error: undefined }));
    void factory().then((value) => {
      if (!disposed) setState({ loading: false, value });
    }).catch((error: unknown) => {
      if (!disposed) setState({ loading: false, error: error instanceof Error ? error.message : String(error) });
    });
    return () => { disposed = true; };
  }, dependencies);
  /* eslint-enable react-hooks/exhaustive-deps */
  return state;
}

function optionSort(a: FilterOption, b: FilterOption): number {
  return a.label.localeCompare(b.label, "ja");
}

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function friendlyId(value: string): string {
  return value.replace(/^work[-_]?type[-_:]?/i, "").replace(/[-_]/g, " ") || value;
}

function toOptionMap(options: FilterOption[]): Map<string, string> {
  return new Map(options.map((option) => [option.id, option.label]));
}

function pushArrayChips(
  chips: Array<{ key: keyof WorkQuery; value?: string; label: string }>,
  key: keyof WorkQuery,
  prefix: string,
  values: string[] | undefined,
  labels: Map<string, string>,
): void {
  for (const value of values ?? []) chips.push({ key, value, label: `${prefix}：${labels.get(value) ?? value}` });
}

function removeChip(query: WorkQuery, key: keyof WorkQuery, value?: string): WorkQuery {
  const next = { ...query };
  if (value !== undefined) {
    const current = next[key];
    if (Array.isArray(current)) {
      const values = current.filter((item) => item !== value);
      if (values.length) (next as Record<string, unknown>)[key] = values;
      else delete (next as Record<string, unknown>)[key];
    }
  } else {
    delete (next as Record<string, unknown>)[key];
  }
  return next;
}
