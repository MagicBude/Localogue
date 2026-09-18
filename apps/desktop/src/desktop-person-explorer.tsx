import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { getPreferredPersonName } from "@/application/services/localization-service";
import type { Asset } from "@/domain/entities/asset";
import type { Person } from "@/domain/entities/person";
import type { PresentationPreference } from "@/domain/entities/presentation-preference";
import type { PersonQuery, PersonSort } from "@/domain/queries/person-query";

import { DesktopAssetImage } from "./desktop-asset-image";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { useDesktopI18n } from "./desktop-i18n";
import { useStableAsyncData } from "./use-stable-async-data";
import { resolvePersonPresentation } from "./desktop-presentation";
import { personActivityStatusLabel } from "./desktop-person-labels";
import { DesktopPagination } from "./desktop-pagination";
import { UiEmptyState } from "./ui/feedback";
import { FilterPopover } from "./ui/filter-popover";
import { queryPeople } from "@/application/library/library-query";

const DEFAULT_PAGE_SIZE = 24;

export type DesktopPersonExplorerState = { query: PersonQuery; page: number; pageSize: number; scrollY: number };

export function DesktopPersonExplorer({
  repository,
  onOpen,
  toolbarAction,
  searchText,
  initialState,
  onStateChange,
}: {
  repository: TauriLibraryRepository;
  onOpen: (id: string) => void;
  toolbarAction?: ReactNode;
  searchText?: string;
  initialState?: DesktopPersonExplorerState;
  onStateChange?: (state: DesktopPersonExplorerState) => void;
}) {
  const { t } = useDesktopI18n();
  const [query, setQuery] = useState<PersonQuery>(() => initialState?.query ?? { sort: "name_asc" });
  const [page, setPage] = useState(() => initialState?.page ?? 1);
  const [pageSize, setPageSize] = useState(() => initialState?.pageSize ?? readPeoplePageSize());
  const resultsPanelRef = useRef<HTMLElement>(null);
  const scrollRestored = useRef(false);
  const data = useAsyncPersonData(async () => {
    const [filteredPeople, allPeople, allWorks, assets, preferences] = await Promise.all([
      repository.listPeople({ ...query, page: 1, pageSize: 100000 }),
      repository.listPeople({ page: 1, pageSize: 100000 }),
      repository.listWorks({ page: 1, pageSize: 100000 }),
      repository.listAssets(),
      repository.listPresentationPreferences(),
    ]);
    const performerIds = new Set(
      allWorks.items.flatMap((work) => work.personRelations
        .filter((relation) => relation.role === "performer")
        .map((relation) => relation.personId)),
    );
    const allPerformers = allPeople.items.filter((person) => performerIds.has(person.id));
    const filteredPerformers = filteredPeople.items.filter((person) => performerIds.has(person.id));
    const workCounts = new Map<string, number>();
    for (const work of allWorks.items) {
      for (const personId of new Set(work.personRelations.filter((relation) => relation.role === "performer").map((relation) => relation.personId))) {
        workCounts.set(personId, (workCounts.get(personId) ?? 0) + 1);
      }
    }
    const portraits = buildPortraitMap(assets, allPerformers, preferences);
    const statusOptions = [...new Set(allPerformers.map((person) => person.activityStatus))].sort();
    const birthYears = toYears(allPerformers.map((person) => person.birthDate?.value));
    const debutYears = toYears(allPerformers.map((person) => careerDate(person, "debut")));
    const retirementYears = toYears(allPerformers.map((person) => careerDate(person, "retirement")));
    const cupSizes = [...new Set(allPerformers.map((person) => person.measurements?.cup).filter((value): value is string => Boolean(value)))].sort();
    return {
      allPerformers,
      filteredPerformers,
      workCounts,
      portraits,
      statusOptions,
      birthYears,
      debutYears,
      retirementYears,
      cupSizes,
      optionCounts: {
        statuses: personOptionCounts(allPerformers, query, "statuses", statusOptions, (person) => person.activityStatus),
        birthYears: personOptionCounts(allPerformers, query, "birthYears", birthYears, (person) => person.birthDate?.value.slice(0, 4)),
        debutYears: personOptionCounts(allPerformers, query, "debutYears", debutYears, (person) => careerDate(person, "debut")?.slice(0, 4)),
        retirementYears: personOptionCounts(allPerformers, query, "retirementYears", retirementYears, (person) => careerDate(person, "retirement")?.slice(0, 4)),
        cupSizes: personOptionCounts(allPerformers, query, "cupSizes", cupSizes, (person) => person.measurements?.cup),
      },
    };
  }, [repository, query]);

  useEffect(() => {
    if (initialState) return;
    setPage(1);
    setQuery((current) => ({ ...current, text: searchText || undefined }));
  }, [initialState, searchText]);

  const publishState = () => onStateChange?.({ query, page, pageSize, scrollY: window.scrollY });
  useEffect(() => publishState(), [page, pageSize, query]);
  useEffect(() => {
    const handleScroll = () => publishState();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [page, pageSize, query]);

  if (data.loading) return <ExplorerState>{t("正在读取人物资料…")}</ExplorerState>;
  if (data.error || !data.value) return <ExplorerState error>{data.error ?? t("无法读取人物。")}</ExplorerState>;

  const total = data.value.filteredPerformers.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = data.value.filteredPerformers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useLayoutEffect(() => {
    if (scrollRestored.current || data.loading || !data.value || initialState === undefined) return;
    scrollRestored.current = true;
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: initialState.scrollY, behavior: "auto" }));
    return () => window.cancelAnimationFrame(frame);
  }, [data.loading, data.value, initialState]);

  function changeQuery(next: PersonQuery): void {
    setPage(1);
    setQuery(next);
  }

  function changePage(nextPage: number): void {
    if (nextPage === currentPage) return;
    setPage(nextPage);
    window.requestAnimationFrame(() => resultsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const pagination = total > 0
    ? <DesktopPagination page={currentPage} pageCount={pageCount} onChange={changePage} pageSize={pageSize} onPageSizeChange={(next) => { setPageSize(next); setPage(1); window.localStorage.setItem("localogue.desktop.people-page-size", String(next)); }} totalLabel={t("共 {count} 项人物", { count: total })} />
    : undefined;

  return (
    <div className="desktop-library-layout">
      <PersonFilterPanel query={query} onChange={changeQuery} data={data.value} toolbarAction={toolbarAction} />
      <section className="desktop-results-panel desktop-people-results" ref={resultsPanelRef}>
        <PersonFilterChips query={query} onChange={changeQuery} />
        <div className="desktop-results-toolbar">
          <div className="result-meta">{data.refreshing ? <span className="desktop-refresh-indicator">{t("正在刷新…")}</span> : null}</div>
          <div className="desktop-results-toolbar__actions">
            <button className="desktop-facet-clear" disabled={!hasPersonFilters(query)} onClick={() => changeQuery({ sort: "name_asc" })} type="button">{t("清除")}</button>
          </div>
        </div>
        <div className="desktop-results-scroll">
          <div className="desktop-person-grid">
            {visible.map((person) => (
              <DesktopPersonCard
                key={person.id}
                person={person}
                portrait={data.value!.portraits.get(person.id)}
                workCount={data.value!.workCounts.get(person.id) ?? 0}
                onOpen={() => { publishState(); onOpen(person.id); }}
              />
            ))}
          </div>
          {!visible.length ? <ExplorerState>{t("没有符合当前筛选条件的演员。")}</ExplorerState> : null}
        </div>
        {pagination ? <div className="desktop-pagination-dock">{pagination}</div> : null}
      </section>
    </div>
  );
}

export function DesktopPersonCard({
  person,
  portrait,
  workCount,
  onOpen,
}: {
  person: Person;
  portrait?: Asset;
  workCount: number;
  onOpen: () => void;
}) {
  const { t, metadataLanguage } = useDesktopI18n();
  const name = getPreferredPersonName(person, metadataLanguage);
  const romanized = person.names.find((item) => item.type === "romanized" && item.value !== name)?.value;
  return (
    <button className="desktop-person-card" onClick={onOpen} type="button">
      <span className="desktop-person-portrait">
        <DesktopAssetImage asset={portrait} alt={`${name} portrait`} fallback={<span className="avatar-placeholder">{name.slice(0, 1)}</span>} />
      </span>
      <span className="desktop-person-card__body">
        <small className="status-chip">{personActivityStatusLabel(person.activityStatus, t)}</small>
        <strong>{name}</strong>
        {romanized ? <span>{romanized}</span> : null}
        <em>{t("{count} 部作品", { count: workCount })}</em>
      </span>
    </button>
  );
}

function PersonFilterPanel({
  query,
  onChange,
  data,
  toolbarAction,
}: {
  query: PersonQuery;
  onChange: (query: PersonQuery) => void;
  data: {
    statusOptions: string[];
    birthYears: string[];
    debutYears: string[];
    retirementYears: string[];
    cupSizes: string[];
    optionCounts: Record<"statuses" | "birthYears" | "debutYears" | "retirementYears" | "cupSizes", Map<string, number>>;
  };
  toolbarAction?: ReactNode;
}) {
  const { t } = useDesktopI18n();
  const patch = (next: Partial<PersonQuery>) => onChange({ ...query, ...next });
  const selectedStatus = query.statuses?.[0] ?? "";
  const selectedBirth = query.birthYears?.[0] ?? "";
  const selectedDebut = query.debutYears?.[0] ?? "";
  const selectedRetirement = query.retirementYears?.[0] ?? "";
  const activeCount = [
    selectedStatus,
    selectedBirth,
    selectedDebut,
    selectedRetirement,
    query.birthPlaceText,
    query.cupSizes?.length,
    query.heightMin,
    query.heightMax,
  ].filter((value) => value !== undefined && value !== "").length
    + [query.hasPortrait, query.hasBirthDate, query.hasHeight, query.hasMeasurements, query.hasBiography].filter((value) => value !== undefined).length;
  return (
    <section className="desktop-facet-bar desktop-person-facet-bar">
      <div className="desktop-facet-bar__primary">
        <label className="field"><span>{t("排序")}</span><select value={query.sort ?? "name_asc"} onChange={(event) => patch({ sort: event.target.value as PersonSort })}>
          <option value="name_asc">{t("名称")} A → Z</option><option value="name_desc">{t("名称")} Z → A</option>
          <option value="debut_desc">{t("出道年份")} ↓</option><option value="debut_asc">{t("出道年份")} ↑</option>
          <option value="birth_desc">{t("出生年份")} ↓</option><option value="birth_asc">{t("出生年份")} ↑</option>
          <option value="height_desc">{t("身高")} ↓</option><option value="height_asc">{t("身高")} ↑</option>
        </select></label>
        <FilterPopover count={activeCount} label={t("筛选")} wide>
          <div className="desktop-filter-section">
            <strong>{t("人物资料")}</strong>
          <div className="desktop-person-filter-menu__grid">
            <SelectField label={t("状态")} value={selectedStatus} options={data.statusOptions} counts={data.optionCounts.statuses} getOptionLabel={(value) => personActivityStatusLabel(value, t)} onChange={(value) => patch({ statuses: value ? [value] : undefined })} />
            <SelectField label={t("出道年份")} value={selectedDebut} options={data.debutYears} counts={data.optionCounts.debutYears} onChange={(value) => patch({ debutYears: value ? [value] : undefined })} />
            <SelectField label={t("引退年份")} value={selectedRetirement} options={data.retirementYears} counts={data.optionCounts.retirementYears} onChange={(value) => patch({ retirementYears: value ? [value] : undefined })} />
            <SelectField label={t("出生年份")} value={selectedBirth} options={data.birthYears} counts={data.optionCounts.birthYears} onChange={(value) => patch({ birthYears: value ? [value] : undefined })} />
            <label className="field"><span>{t("身高 ≥")}</span><input min="0" value={query.heightMin ?? ""} onChange={(event) => patch({ heightMin: parseOptionalNumber(event.target.value) })} placeholder="150" type="number" /></label>
            <label className="field"><span>{t("身高 ≤")}</span><input min="0" value={query.heightMax ?? ""} onChange={(event) => patch({ heightMax: parseOptionalNumber(event.target.value) })} placeholder="175" type="number" /></label>
          </div>
          </div>
          <div className="desktop-filter-section">
            <strong>{t("身体与地区")}</strong>
            <div className="desktop-person-filter-menu__grid">
              <label className="field"><span>{t("出生地")}</span><input value={query.birthPlaceText ?? ""} onChange={(event) => patch({ birthPlaceText: event.target.value || undefined })} placeholder={t("输入地区名称")} /></label>
              <SelectField label={t("罩杯")} value={query.cupSizes?.[0] ?? ""} options={data.cupSizes} counts={data.optionCounts.cupSizes} onChange={(value) => patch({ cupSizes: value ? [value] : undefined })} />
            </div>
          </div>
          <div className="desktop-filter-section">
            <strong>{t("资料情况")}</strong>
            <div className="desktop-person-filter-menu__grid desktop-person-presence-grid">
              <PresenceSelect label={t("人物图片")} value={query.hasPortrait} onChange={(value) => patch({ hasPortrait: value })} />
              <PresenceSelect label={t("出生日期")} value={query.hasBirthDate} onChange={(value) => patch({ hasBirthDate: value })} />
              <PresenceSelect label={t("身高资料")} value={query.hasHeight} onChange={(value) => patch({ hasHeight: value })} />
              <PresenceSelect label={t("三围资料")} value={query.hasMeasurements} onChange={(value) => patch({ hasMeasurements: value })} />
              <PresenceSelect label={t("人物简介")} value={query.hasBiography} onChange={(value) => patch({ hasBiography: value })} />
            </div>
          </div>
        </FilterPopover>
        {toolbarAction ? <div className="desktop-browser-toolbar-action">{toolbarAction}</div> : null}
      </div>
    </section>
  );
}

function PersonFilterChips({ query, onChange }: { query: PersonQuery; onChange: (query: PersonQuery) => void }) {
  const { t } = useDesktopI18n();
  const selectedStatus = query.statuses?.[0];
  const selectedBirth = query.birthYears?.[0];
  const selectedDebut = query.debutYears?.[0];
  const selectedRetirement = query.retirementYears?.[0];
  const chips: Array<{ label: string; clear: () => void }> = [];
  if (query.text) chips.push({ label: `${t("搜索")}: ${query.text}`, clear: () => onChange({ ...query, text: undefined }) });
  if (selectedStatus) chips.push({ label: `${t("状态")}: ${personActivityStatusLabel(selectedStatus, t)}`, clear: () => onChange({ ...query, statuses: undefined }) });
  if (selectedDebut) chips.push({ label: `${t("出道年份")}: ${selectedDebut}`, clear: () => onChange({ ...query, debutYears: undefined }) });
  if (selectedRetirement) chips.push({ label: `${t("引退年份")}: ${selectedRetirement}`, clear: () => onChange({ ...query, retirementYears: undefined }) });
  if (selectedBirth) chips.push({ label: `${t("出生年份")}: ${selectedBirth}`, clear: () => onChange({ ...query, birthYears: undefined }) });
  if (query.birthPlaceText) chips.push({ label: `${t("出生地")}: ${query.birthPlaceText}`, clear: () => onChange({ ...query, birthPlaceText: undefined }) });
  if (query.cupSizes?.[0]) chips.push({ label: `${t("罩杯")}: ${query.cupSizes[0]}`, clear: () => onChange({ ...query, cupSizes: undefined }) });
  if (query.heightMin !== undefined) chips.push({ label: `${t("身高 ≥")}: ${query.heightMin}`, clear: () => onChange({ ...query, heightMin: undefined }) });
  if (query.heightMax !== undefined) chips.push({ label: `${t("身高 ≤")}: ${query.heightMax}`, clear: () => onChange({ ...query, heightMax: undefined }) });
  pushPresenceChip(chips, t("人物图片"), query.hasPortrait, () => onChange({ ...query, hasPortrait: undefined }), t);
  pushPresenceChip(chips, t("出生日期"), query.hasBirthDate, () => onChange({ ...query, hasBirthDate: undefined }), t);
  pushPresenceChip(chips, t("身高资料"), query.hasHeight, () => onChange({ ...query, hasHeight: undefined }), t);
  pushPresenceChip(chips, t("三围资料"), query.hasMeasurements, () => onChange({ ...query, hasMeasurements: undefined }), t);
  pushPresenceChip(chips, t("人物简介"), query.hasBiography, () => onChange({ ...query, hasBiography: undefined }), t);
  if (!chips.length) return null;
  return <div className="desktop-active-filters"><strong>{t("已选筛选")}</strong><div>{chips.map((chip) => <button key={chip.label} onClick={chip.clear} type="button">{chip.label} ×</button>)}</div></div>;
}

function hasPersonFilters(query: PersonQuery): boolean {
  return Boolean(query.text || query.statuses?.length || query.birthYears?.length || query.debutYears?.length || query.retirementYears?.length || query.birthPlaceText || query.cupSizes?.length || query.heightMin !== undefined || query.heightMax !== undefined || query.hasPortrait !== undefined || query.hasBirthDate !== undefined || query.hasHeight !== undefined || query.hasMeasurements !== undefined || query.hasBiography !== undefined);
}

function pushPresenceChip(chips: Array<{ label: string; clear: () => void }>, label: string, value: boolean | undefined, clear: () => void, t: (key: string) => string): void {
  if (value !== undefined) chips.push({ label: `${label}: ${value ? t("有") : t("无")}`, clear });
}

function readPeoplePageSize(): number {
  const value = Number(window.localStorage.getItem("localogue.desktop.people-page-size"));
  return [12, 24, 48, 96].includes(value) ? value : DEFAULT_PAGE_SIZE;
}

function SelectField({ label, value, options, counts, onChange, getOptionLabel }: { label: string; value: string; options: string[]; counts?: Map<string, number>; onChange: (value: string) => void; getOptionLabel?: (value: string) => string }) {
  const { t } = useDesktopI18n();
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">{t("任意")}</option>{options.map((option) => <option key={option} value={option}>{getOptionLabel ? getOptionLabel(option) : option}{counts ? ` (${counts.get(option) ?? 0})` : ""}</option>)}</select></label>;
}

function personOptionCounts(people: Person[], query: PersonQuery, key: keyof PersonQuery, options: string[], valueOf: (person: Person) => string | undefined): Map<string, number> {
  const facetQuery = { ...query };
  delete facetQuery[key];
  delete facetQuery.page;
  delete facetQuery.pageSize;
  const eligible = queryPeople(people, { ...facetQuery, page: 1, pageSize: Math.max(1, people.length) }).items;
  const counts = new Map(options.map((option) => [option, 0]));
  for (const person of eligible) {
    const value = valueOf(person);
    if (value && counts.has(value)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function PresenceSelect({ label, value, onChange }: { label: string; value?: boolean; onChange: (value?: boolean) => void }) {
  const { t } = useDesktopI18n();
  return <label className="field"><span>{label}</span><select value={value === undefined ? "" : String(value)} onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value === "true")}><option value="">{t("任意")}</option><option value="true">{t("有")}</option><option value="false">{t("无")}</option></select></label>;
}

function buildPortraitMap(assets: Asset[], people: Person[], preferences: PresentationPreference[]): Map<string, Asset> {
  const preferenceByPersonId = new Map(preferences.filter((item) => item.entityType === "person").map((item) => [item.entityId, item]));
  const result = new Map<string, Asset>();
  for (const person of people) {
    const portrait = resolvePersonPresentation(person, assets, preferenceByPersonId.get(person.id)).resolved;
    if (portrait) result.set(person.id, portrait);
  }
  return result;
}

function toYears(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
}

function careerDate(person: Person, type: Person["careerEvents"][number]["type"]): string | undefined {
  return person.careerEvents.filter((event) => event.type === type && event.date?.value).map((event) => event.date!.value).sort()[0];
}

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function ExplorerState({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <UiEmptyState className="desktop-explorer-state" tone={error ? "error" : "neutral"} title={children} />;
}

function useAsyncPersonData<T>(factory: () => Promise<T>, dependencies: readonly unknown[]) {
  return useStableAsyncData(factory, dependencies, (error) => error instanceof Error ? error.message : String(error));
}
