import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import {
  getPreferredPersonName,
  localizeText,
} from "@/application/services/localization-service";
import { localizeGenre } from "@/application/services/genre-localization-service";
import { workTypeDefinition } from "@/application/importers/import-classification-normalizer";
import type { WorkQuery, WorkSearchResult, WorkSort } from "@/domain/queries/work-query";

import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { useDesktopI18n } from "./desktop-i18n";
import { useFavorites } from "./desktop-favorites-provider";
import { useStableAsyncData } from "./use-stable-async-data";
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
  resolutions: FilterOption[];
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
  const { persistedRevision } = useFavorites();
  const stateStorageKey = `${storageKey}.navigation-state`;
  const restoredState = useMemo(() => readExplorerNavigationState(stateStorageKey), [stateStorageKey]);
  const pendingScrollY = useRef(restoredState?.scrollY);
  const [query, setQuery] = useState<WorkQuery>(() => ({
    sort: "release_desc",
    ...restoredState?.query,
    // 来自收藏页、人物页或分类入口的固定初始条件优先，不能被旧浏览状态冲掉。
    ...initialQuery,
  }));
  const [page, setPage] = useState(() => restoredState?.page ?? 1);
  const [view, setView] = useState<DesktopWorkViewMode>(() => {
    const saved = window.localStorage.getItem(storageKey);
    return saved === "list" || saved === "table" || saved === "waterfall" ? saved : "grid";
  });

  const data = useAsyncExplorerData(async () => {
    const effectiveQuery: WorkQuery = {
      ...query,
      ...(fixedPersonId ? { personIds: [fixedPersonId] } : {}),
      page,
      pageSize,
    };
    const result = await repository.listWorks(effectiveQuery);
    const [peopleResult, organizations, series, genres, tags, assets, preferences] = await Promise.all([
      repository.listPeople({ page: 1, pageSize: 100000 }),
      repository.listOrganizations(),
      repository.listSeries(),
      repository.listGenres(),
      repository.listTags(),
      repository.listAssets(),
      repository.listPresentationPreferences(),
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
        label: localizeGenre(item, metadataLanguage, item.id),
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
        label: workTypeDefinition(id) ? localizeText(workTypeDefinition(id)!.names, metadataLanguage, id) : friendlyId(id),
        count: result.facets.workTypes.find((facet) => facet.id === id)?.count ?? 0,
      }))
      .sort(optionSort);

    const years = result.facets.years.map((facet) => ({
      id: facet.id,
      label: facet.id,
      count: facet.count,
    }));
    const resolutionLabels: Record<string, string> = { "4k": "4K", "1080p": "1080P", "720p": "720P", sd: "SD" };
    const resolutions = result.facets.resolutions.map((facet) => ({ id: facet.id, label: resolutionLabels[facet.id] ?? facet.id, count: facet.count }));

    return {
      result,
      cards: buildDesktopWorkCards(result.items, peopleResult.items, organizations, assets, metadataLanguage, preferences),
      people,
      directors,
      makers,
      labels,
      series: seriesOptions,
      genres: genreOptions,
      tags: tagOptions,
      workTypes,
      years,
      resolutions,
    };
  // 收藏 / 评分会参与筛选和排序，所以成功落盘后必须重新执行同一 WorkQuery。
  // 版本只在 Native 写入完成后递增，避免乐观 UI 抢先查询而读回旧文件。
  }, [repository, query, page, pageSize, fixedPersonId, metadataLanguage, persistedRevision]);

  // 页码和筛选是“从详情返回后继续浏览”的导航上下文。使用 sessionStorage，
  // 让它只在当前应用会话内生效；关闭应用后仍从干净的第一页开始。
  useEffect(() => {
    writeExplorerNavigationState(stateStorageKey, { query, page });
  }, [page, query, stateStorageKey]);

  // 资料库切换或筛选变化后，总页数可能缩小。共享 queryWorks 会返回已经夹紧的
  // 实际页码，这里把组件 state 同步过去，避免 UI 继续拿“第 7 页”逐页往前翻。
  useEffect(() => {
    const actualPage = data.value?.result.page;
    if (actualPage !== undefined && actualPage !== page) setPage(actualPage);
  }, [data.value?.result.page, page]);

  // 详情页返回时等待作品 DOM 恢复高度，再回到进入详情前的位置。该值只消费一次，
  // 后续筛选刷新不会反复拉动滚动条。
  useEffect(() => {
    if (!data.value || pendingScrollY.current === undefined) return;
    const scrollY = pendingScrollY.current;
    pendingScrollY.current = undefined;
    clearExplorerReturnPosition(stateStorageKey);
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: "auto" }));
    return () => window.cancelAnimationFrame(frame);
  }, [data.value, stateStorageKey]);

  function changeQuery(next: WorkQuery): void {
    setPage(1);
    setQuery(next);
  }

  function changeView(next: DesktopWorkViewMode): void {
    setView(next);
    window.localStorage.setItem(storageKey, next);
  }

  function openWork(workId: string): void {
    // 在卸载 Explorer、进入详情页之前同步记录滚动位置；sessionStorage 是同步 API，
    // 因此不会发生导航已经完成而位置尚未来得及保存的竞态。
    writeExplorerNavigationState(stateStorageKey, { query, page, scrollY: window.scrollY });
    onOpen(workId);
  }

  if (data.loading) return <ExplorerState>{t("正在读取作品与 Facet…")}</ExplorerState>;
  if (data.error || !data.value) return <ExplorerState error>{data.error ?? t("无法读取作品。")}</ExplorerState>;

  const { result, cards } = data.value;
  const pageCount = Math.max(1, Math.ceil(result.total / pageSize));

  return (
    <div className="desktop-library-layout">
      <WorkFacetPanel
        query={query}
        onChange={changeQuery}
        view={view}
        onViewChange={changeView}
        fixedPersonId={fixedPersonId}
        data={data.value}
      />

      <section className="desktop-results-panel">
        <DesktopWorkFilterChips query={query} data={data.value} onChange={changeQuery} />
        <div className="desktop-results-toolbar">
          <div className="result-meta">
            {t("{count} 项作品 · 第 {page} / {pages} 页", { count: result.total, page: result.page, pages: pageCount })}
            {data.refreshing ? <span className="desktop-refresh-indicator"> · {t("正在刷新…")}</span> : null}
          </div>
        </div>
        <DesktopWorkResults cards={cards} view={view} onOpen={openWork} />
        {!cards.length ? <ExplorerState>{t("没有符合当前筛选条件的作品。")}</ExplorerState> : null}
        {result.total > pageSize ? (
          <div className="desktop-pagination" aria-label={t("分页")}>
            <button disabled={result.page <= 1} onClick={() => setPage(Math.max(1, result.page - 1))}>← {t("上一页")}</button>
            <span>{result.page} / {pageCount}</span>
            <button disabled={result.page >= pageCount} onClick={() => setPage(Math.min(pageCount, result.page + 1))}>{t("下一页")} →</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function WorkFacetPanel({
  query,
  onChange,
  view,
  onViewChange,
  fixedPersonId,
  data,
}: {
  query: WorkQuery;
  onChange: (query: WorkQuery) => void;
  view: DesktopWorkViewMode;
  onViewChange: (view: DesktopWorkViewMode) => void;
  fixedPersonId?: string;
  data: ExplorerData;
}) {
  const { t } = useDesktopI18n();
  const patch = (next: Partial<WorkQuery>) => onChange({ ...query, ...next });
  const [drawerOpen, setDrawerOpen] = useState(() => countAdvancedFilters(query) > 0);
  const advancedCount = countAdvancedFilters(query);
  return (
    <aside className="desktop-facet-bar">
      <div className="desktop-facet-bar__primary">
        <label className="field desktop-facet-search">
          <input
            aria-label={t("搜索番号或标题")}
            value={query.text ?? ""}
            onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ text: event.target.value || undefined })}
            placeholder={t("搜索番号或标题")}
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
            <option value="rating_desc">{t("评分")} ↓</option>
            <option value="rating_asc">{t("评分")} ↑</option>
          </select>
        </label>

        <label className="field check-inline desktop-facet-fav">
          <input
            type="checkbox"
            checked={query.favoriteOnly === true}
            onChange={(event) => patch({ favoriteOnly: event.target.checked || undefined })}
          />
          <span>{t("仅看收藏")}</span>
        </label>

        <label className="field desktop-facet-rating">
          <span>{t("评分至少")}</span>
          <select
            value={query.ratingMin ?? ""}
            onChange={(event) => patch({ ratingMin: event.target.value ? Number(event.target.value) : undefined })}
          >
            <option value="">{t("任意")}</option>
            <option value="1">★1+</option>
            <option value="2">★2+</option>
            <option value="3">★3+</option>
            <option value="4">★4+</option>
            <option value="5">★5</option>
          </select>
        </label>

        <button
          type="button"
          className="desktop-facet-toggle"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((value) => !value)}
        >
          <span>{t("更多筛选")}</span>
          {advancedCount ? <span className="desktop-facet-toggle__badge">{advancedCount}</span> : null}
          <span className="desktop-facet-toggle__caret">{drawerOpen ? "▴" : "▾"}</span>
        </button>

        <DesktopWorkViewSwitcher current={view} onChange={onViewChange} />

        <button type="button" className="ghost-button desktop-facet-clear" onClick={() => onChange({ sort: "release_desc" })}>
          {t("清除")}
        </button>
      </div>

      {drawerOpen ? (
        <div className="desktop-facet-bar__drawer">
          <div className="desktop-facet-bar__pairs">
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
          </div>

          <div className="desktop-facet-bar__groups">
            {!fixedPersonId ? <FilterGroup label={t("演员")} values={query.personIds} options={data.people} onChange={(values) => patch({ personIds: values.length ? values : undefined })} /> : null}
            <FilterGroup label={t("导演")} values={query.directorIds} options={data.directors} onChange={(values) => patch({ directorIds: values.length ? values : undefined })} />
            <FilterGroup label={t("年份")} values={query.releaseYears} options={data.years} onChange={(values) => patch({ releaseYears: values.length ? values : undefined })} />
            <FilterGroup label={t("清晰度")} values={query.resolutionTiers} options={data.resolutions} onChange={(values) => patch({ resolutionTiers: values.length ? values as WorkQuery["resolutionTiers"] : undefined })} />
            <FilterGroup label={t("作品类型")} values={query.workTypeIds} options={data.workTypes} onChange={(values) => patch({ workTypeIds: values.length ? values : undefined })} />
            <FilterGroup label={t("厂商")} values={query.makerIds} options={data.makers} onChange={(values) => patch({ makerIds: values.length ? values : undefined })} />
            <FilterGroup label={t("厂牌")} values={query.labelIds} options={data.labels} onChange={(values) => patch({ labelIds: values.length ? values : undefined })} />
            <FilterGroup label={t("系列")} values={query.seriesIds} options={data.series} onChange={(values) => patch({ seriesIds: values.length ? values : undefined })} />
            <FilterGroup label={t("题材")} values={query.genreIds} options={data.genres} onChange={(values) => patch({ genreIds: values.length ? values : undefined })} />
            <FilterGroup label={t("标签")} values={query.tagIds} options={data.tags} onChange={(values) => patch({ tagIds: values.length ? values : undefined })} />
          </div>
        </div>
      ) : null}
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
    resolutionTiers: toOptionMap(data.resolutions),
  }), [data]);

  const chips: Array<{ key: keyof WorkQuery; value?: string; label: string }> = [];
  if (query.text) chips.push({ key: "text", label: `${t("关键词")}：${query.text}` });
  pushArrayChips(chips, "personIds", t("演员"), query.personIds, maps.personIds);
  pushArrayChips(chips, "directorIds", t("导演"), query.directorIds, maps.directorIds);
  pushArrayChips(chips, "makerIds", t("厂商"), query.makerIds, maps.makerIds);
  pushArrayChips(chips, "labelIds", t("厂牌"), query.labelIds, maps.labelIds);
  pushArrayChips(chips, "seriesIds", t("系列"), query.seriesIds, maps.seriesIds);
  pushArrayChips(chips, "genreIds", t("题材"), query.genreIds, maps.genreIds);
  pushArrayChips(chips, "workTypeIds", t("类型"), query.workTypeIds, maps.workTypeIds);
  pushArrayChips(chips, "tagIds", t("标签"), query.tagIds, maps.tagIds);
  pushArrayChips(chips, "releaseYears", t("年份"), query.releaseYears, maps.releaseYears);
  pushArrayChips(chips, "resolutionTiers", t("清晰度"), query.resolutionTiers, maps.resolutionTiers);
  if (query.releaseFrom) chips.push({ key: "releaseFrom", label: `${t("发行日期")} ≥ ${query.releaseFrom}` });
  if (query.releaseTo) chips.push({ key: "releaseTo", label: `${t("发行日期")} ≤ ${query.releaseTo}` });
  if (query.durationMin !== undefined) chips.push({ key: "durationMin", label: `${t("时长")} ≥ ${query.durationMin}` });
  if (query.durationMax !== undefined) chips.push({ key: "durationMax", label: `${t("时长")} ≤ ${query.durationMax}` });
  if (query.hasCover !== undefined) chips.push({ key: "hasCover", label: `${t("封面")}：${query.hasCover ? t("是") : t("否")}` });
  if (query.hasMedia !== undefined) chips.push({ key: "hasMedia", label: `${t("媒体")}：${query.hasMedia ? t("是") : t("否")}` });
  if (query.favoriteOnly) chips.push({ key: "favoriteOnly", label: t("仅看收藏") });
  if (query.ratingMin !== undefined) chips.push({ key: "ratingMin", label: `${t("评分至少")} ${query.ratingMin}★` });

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
  return useStableAsyncData(factory, dependencies, (error) => error instanceof Error ? error.message : String(error));
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

interface ExplorerNavigationState {
  query: WorkQuery;
  page: number;
  scrollY?: number;
}

/** 本机状态可能来自旧版本或手工修改，读取失败时安全回到默认浏览状态。 */
function readExplorerNavigationState(key: string): ExplorerNavigationState | undefined {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(key) ?? "null") as Partial<ExplorerNavigationState> | null;
    if (!parsed || typeof parsed !== "object") return undefined;
    return {
      query: parsed.query && typeof parsed.query === "object" ? parsed.query : {},
      page: typeof parsed.page === "number" && Number.isInteger(parsed.page) && parsed.page > 0 ? parsed.page : 1,
      ...(typeof parsed.scrollY === "number" && Number.isFinite(parsed.scrollY) && parsed.scrollY >= 0
        ? { scrollY: parsed.scrollY }
        : {}),
    };
  } catch {
    return undefined;
  }
}

function writeExplorerNavigationState(
  key: string,
  state: Omit<ExplorerNavigationState, "scrollY"> & { scrollY?: number },
): void {
  const previous = readExplorerNavigationState(key);
  window.sessionStorage.setItem(key, JSON.stringify({
    query: state.query,
    page: state.page,
    // 普通筛选更新时保留尚未消费的返回位置；打开作品时传入新位置覆盖它。
    ...(state.scrollY !== undefined ? { scrollY: state.scrollY } : previous?.scrollY !== undefined ? { scrollY: previous.scrollY } : {}),
  }));
}

function clearExplorerReturnPosition(key: string): void {
  const current = readExplorerNavigationState(key);
  if (!current) return;
  window.sessionStorage.setItem(key, JSON.stringify({ query: current.query, page: current.page }));
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

/**
 * 统计“抽屉”中已选的高级筛选数量：用于「更多筛选」按钮上的徽标，
 * 以及首次进入时是否自动展开抽屉。基础栏里的搜索/排序/收藏/评分不计入，
 * 因为它们始终可见。
 */
function countAdvancedFilters(query: WorkQuery): number {
  const arrayKeys: Array<keyof WorkQuery> = [
    "personIds", "directorIds", "releaseYears", "resolutionTiers",
    "workTypeIds", "makerIds", "labelIds", "seriesIds", "genreIds", "tagIds",
  ];
  let count = 0;
  for (const key of arrayKeys) {
    const value = query[key];
    if (Array.isArray(value)) count += value.length;
  }
  if (query.releaseFrom) count += 1;
  if (query.releaseTo) count += 1;
  if (query.durationMin !== undefined) count += 1;
  if (query.durationMax !== undefined) count += 1;
  if (query.hasCover !== undefined) count += 1;
  if (query.hasMedia !== undefined) count += 1;
  return count;
}
