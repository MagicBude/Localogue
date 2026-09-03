import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";

import { getPreferredPersonName } from "@/application/services/localization-service";
import type { Asset } from "@/domain/entities/asset";
import type { Person } from "@/domain/entities/person";
import type { PersonQuery, PersonSort } from "@/domain/queries/person-query";

import { DesktopAssetImage } from "./desktop-asset-image";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";

const PAGE_SIZE = 24;

export function DesktopPersonExplorer({
  repository,
  onOpen,
}: {
  repository: TauriLibraryRepository;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState<PersonQuery>({ sort: "name_asc" });
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [query]);

  const data = useAsyncPersonData(async () => {
    const [filteredPeople, allPeople, allWorks, assets] = await Promise.all([
      repository.listPeople({ ...query, page: 1, pageSize: 100000 }),
      repository.listPeople({ page: 1, pageSize: 100000 }),
      repository.listWorks({ page: 1, pageSize: 100000 }),
      repository.listAssets(),
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
    const portraits = buildPortraitMap(assets, allPerformers);
    return {
      allPerformers,
      filteredPerformers,
      workCounts,
      portraits,
      statusOptions: [...new Set(allPerformers.map((person) => person.activityStatus))].sort(),
      birthYears: toYears(allPerformers.map((person) => person.birthDate?.value)),
      debutYears: toYears(allPerformers.map((person) => careerDate(person, "debut"))),
      retirementYears: toYears(allPerformers.map((person) => careerDate(person, "retirement"))),
    };
  }, [repository, query]);

  if (data.loading) return <ExplorerState>正在读取人物资料…</ExplorerState>;
  if (data.error || !data.value) return <ExplorerState error>{data.error ?? "无法读取人物。"}</ExplorerState>;

  const total = data.value.filteredPerformers.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = data.value.filteredPerformers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <PersonFilterPanel query={query} onChange={setQuery} data={data.value} />
      <section className="desktop-results-panel desktop-people-results">
        <div className="desktop-results-toolbar">
          <div className="result-meta"><strong>{total}</strong> 项人物 · 第 {currentPage} / {pageCount} 页</div>
        </div>
        <div className="desktop-person-grid">
          {visible.map((person) => (
            <DesktopPersonCard
              key={person.id}
              person={person}
              portrait={data.value!.portraits.get(person.id)}
              workCount={data.value!.workCounts.get(person.id) ?? 0}
              onOpen={() => onOpen(person.id)}
            />
          ))}
        </div>
        {!visible.length ? <ExplorerState>没有符合当前筛选条件的演员。</ExplorerState> : null}
        {total > PAGE_SIZE ? (
          <div className="desktop-pagination" aria-label="人物分页">
            <button disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← 上一页</button>
            <span>{currentPage} / {pageCount}</span>
            <button disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>下一页 →</button>
          </div>
        ) : null}
      </section>
    </>
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
  const name = getPreferredPersonName(person, "ja");
  const romanized = person.names.find((item) => item.type === "romanized" && item.value !== name)?.value;
  return (
    <button className="desktop-person-card" onClick={onOpen} type="button">
      <span className="desktop-person-portrait">
        <DesktopAssetImage asset={portrait} alt={`${name} portrait`} fallback={<span className="avatar-placeholder">{name.slice(0, 1)}</span>} />
      </span>
      <span className="desktop-person-card__body">
        <small className="status-chip">{person.activityStatus}</small>
        <strong>{name}</strong>
        {romanized ? <span>{romanized}</span> : null}
        <em>{workCount} 部作品</em>
      </span>
    </button>
  );
}

function PersonFilterPanel({
  query,
  onChange,
  data,
}: {
  query: PersonQuery;
  onChange: (query: PersonQuery) => void;
  data: {
    statusOptions: string[];
    birthYears: string[];
    debutYears: string[];
    retirementYears: string[];
  };
}) {
  const patch = (next: Partial<PersonQuery>) => onChange({ ...query, ...next });
  const selectedStatus = query.statuses?.[0] ?? "";
  const selectedBirth = query.birthYears?.[0] ?? "";
  const selectedDebut = query.debutYears?.[0] ?? "";
  const selectedRetirement = query.retirementYears?.[0] ?? "";
  return (
    <section className="desktop-person-filter-panel">
      <div className="desktop-person-filter-heading">
        <div><strong>人物高级筛选</strong><small>姓名 / 状态 / 年份 / 身高 / 排序</small></div>
        <button onClick={() => onChange({ sort: "name_asc" })} type="button">清除</button>
      </div>
      <div className="desktop-person-filter-grid">
        <label className="field desktop-person-search"><span>搜索姓名 / 别名 / 旧艺名</span><input value={query.text ?? ""} onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ text: event.target.value || undefined })} type="search" /></label>
        <SelectField label="状态" value={selectedStatus} options={data.statusOptions} onChange={(value) => patch({ statuses: value ? [value] : undefined })} />
        <SelectField label="出道年份" value={selectedDebut} options={data.debutYears} onChange={(value) => patch({ debutYears: value ? [value] : undefined })} />
        <SelectField label="引退年份" value={selectedRetirement} options={data.retirementYears} onChange={(value) => patch({ retirementYears: value ? [value] : undefined })} />
        <SelectField label="出生年份" value={selectedBirth} options={data.birthYears} onChange={(value) => patch({ birthYears: value ? [value] : undefined })} />
        <label className="field"><span>身高 ≥</span><input min="0" value={query.heightMin ?? ""} onChange={(event) => patch({ heightMin: parseOptionalNumber(event.target.value) })} placeholder="150" type="number" /></label>
        <label className="field"><span>身高 ≤</span><input min="0" value={query.heightMax ?? ""} onChange={(event) => patch({ heightMax: parseOptionalNumber(event.target.value) })} placeholder="175" type="number" /></label>
        <label className="field"><span>排序</span><select value={query.sort ?? "name_asc"} onChange={(event) => patch({ sort: event.target.value as PersonSort })}>
          <option value="name_asc">名称 A → Z</option><option value="name_desc">名称 Z → A</option>
          <option value="debut_desc">出道年份 ↓</option><option value="debut_asc">出道年份 ↑</option>
          <option value="birth_desc">出生年份 ↓</option><option value="birth_asc">出生年份 ↑</option>
          <option value="height_desc">身高 ↓</option><option value="height_asc">身高 ↑</option>
        </select></label>
      </div>
    </section>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">任意</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function buildPortraitMap(assets: Asset[], people: Person[]): Map<string, Asset> {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const result = new Map<string, Asset>();
  for (const person of people) {
    const referenced = person.portraitAssetId ? assetsById.get(person.portraitAssetId) : undefined;
    const subject = assets.find((asset) => asset.subjectType === "person" && asset.subjectId === person.id && asset.type === "portrait");
    if (referenced ?? subject) result.set(person.id, (referenced ?? subject)!);
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
  return <div className={error ? "empty-state desktop-explorer-state error-state" : "empty-state desktop-explorer-state"}>{children}</div>;
}

function useAsyncPersonData<T>(factory: () => Promise<T>, dependencies: readonly unknown[]) {
  const [state, setState] = useState<{ loading: boolean; value?: T; error?: string }>({ loading: true });
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    let disposed = false;
    setState((current) => ({ ...current, loading: true, error: undefined }));
    void factory().then((value) => { if (!disposed) setState({ loading: false, value }); })
      .catch((error: unknown) => { if (!disposed) setState({ loading: false, error: error instanceof Error ? error.message : String(error) }); });
    return () => { disposed = true; };
  }, dependencies);
  /* eslint-enable react-hooks/exhaustive-deps */
  return state;
}
