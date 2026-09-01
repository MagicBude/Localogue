import path from "node:path";

import type { Asset } from "@/domain/entities/asset";
import type { Genre, Tag } from "@/domain/entities/classification";
import type { Organization } from "@/domain/entities/organization";
import type { Person } from "@/domain/entities/person";
import type { Series } from "@/domain/entities/series";
import type { Work } from "@/domain/entities/work";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import type {
  PersonQuery,
  PersonSearchResult,
} from "@/domain/queries/person-query";
import type {
  FacetCount,
  WorkFacets,
  WorkQuery,
  WorkSearchResult,
  WorkSort,
} from "@/domain/queries/work-query";
import { JsonFileStore } from "@/infrastructure/repositories/json-file-store";

const DEFAULT_PAGE_SIZE = 24;

/**
 * V1 的文件化 Repository。
 *
 * 重要：上层只依赖 LibraryRepository 接口。
 * 未来 V2 的 SqliteLibraryRepository 会实现同一个接口，页面不需要知道数据源已经改变。
 */
export class JsonLibraryRepository implements LibraryRepository {
  private readonly store: JsonFileStore;

  constructor(libraryRoot = path.join(process.cwd(), "data", "library")) {
    this.store = new JsonFileStore(libraryRoot);
  }

  async findWorkById(id: string): Promise<Work | null> {
    const works = await this.store.readCollection<Work>("works");
    return works.find((work) => work.id === id) ?? null;
  }

  async findWorkByCode(code: string): Promise<Work | null> {
    const normalized = code.trim().toUpperCase();
    const works = await this.store.readCollection<Work>("works");
    return works.find((work) => work.code.toUpperCase() === normalized) ?? null;
  }

  async listWorks(query: WorkQuery = {}): Promise<WorkSearchResult> {
    const works = await this.store.readCollection<Work>("works");
    const filtered = works.filter((work) => matchesWork(work, query));
    const sorted = [...filtered].sort(createWorkComparator(query.sort));

    const pageSize = positiveInteger(query.pageSize, DEFAULT_PAGE_SIZE);
    const page = positiveInteger(query.page, 1);
    const start = (page - 1) * pageSize;

    return {
      items: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page,
      pageSize,
      facets: buildWorkFacets(filtered),
    };
  }

  async findPersonById(id: string): Promise<Person | null> {
    const people = await this.store.readCollection<Person>("people");
    return people.find((person) => person.id === id) ?? null;
  }

  async listPeople(query: PersonQuery = {}): Promise<PersonSearchResult> {
    const people = await this.store.readCollection<Person>("people");
    const text = query.text?.trim().toLocaleLowerCase();

    const filtered = people.filter((person) => {
      if (
        query.statuses?.length &&
        !query.statuses.includes(person.activityStatus)
      ) {
        return false;
      }

      if (text) {
        const searchable = person.names
          .map((name) => name.value)
          .join(" ")
          .toLocaleLowerCase();
        if (!searchable.includes(text)) {
          return false;
        }
      }

      return true;
    });

    // V1 暂按主要姓名排序；以后可增加出道时间、作品数等人物排序方式。
    filtered.sort((a, b) => getPersonSortName(a).localeCompare(getPersonSortName(b), "ja"));

    const pageSize = positiveInteger(query.pageSize, DEFAULT_PAGE_SIZE);
    const page = positiveInteger(query.page, 1);
    const start = (page - 1) * pageSize;

    return {
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  }

  async findOrganizationById(id: string): Promise<Organization | null> {
    const organizations = await this.listOrganizations();
    return organizations.find((item) => item.id === id) ?? null;
  }

  listOrganizations(): Promise<Organization[]> {
    return this.store.readCollection<Organization>("organizations");
  }

  async findSeriesById(id: string): Promise<Series | null> {
    const series = await this.listSeries();
    return series.find((item) => item.id === id) ?? null;
  }

  listSeries(): Promise<Series[]> {
    return this.store.readCollection<Series>("series");
  }

  async findAssetById(id: string): Promise<Asset | null> {
    const assets = await this.listAssets();
    return assets.find((item) => item.id === id) ?? null;
  }

  listAssets(): Promise<Asset[]> {
    return this.store.readCollection<Asset>("assets");
  }

  listGenres(): Promise<Genre[]> {
    return this.store.readCollection<Genre>("genres");
  }

  listTags(): Promise<Tag[]> {
    return this.store.readCollection<Tag>("tags");
  }

  saveWork(work: Work): Promise<void> {
    return this.store.writeEntity("works", work);
  }

  savePerson(person: Person): Promise<void> {
    return this.store.writeEntity("people", person);
  }
}

function matchesWork(work: Work, query: WorkQuery): boolean {
  if (query.text) {
    const needle = query.text.trim().toLocaleLowerCase();
    const titles = Object.values(work.titles).filter(Boolean).join(" ");
    const searchable = `${work.code} ${titles}`.toLocaleLowerCase();
    if (!searchable.includes(needle)) {
      return false;
    }
  }

  const performerIds = work.personRelations
    .filter((relation) => relation.role === "performer")
    .map((relation) => relation.personId);
  const directorIds = work.personRelations
    .filter((relation) => relation.role === "director")
    .map((relation) => relation.personId);

  if (!containsAny(performerIds, query.personIds)) return false;
  if (!containsAny(directorIds, query.directorIds)) return false;
  if (!containsScalar(work.makerId, query.makerIds)) return false;
  if (!containsScalar(work.labelId, query.labelIds)) return false;
  if (!containsAny(work.seriesIds, query.seriesIds)) return false;
  if (!containsAny(work.genreIds, query.genreIds)) return false;
  if (!containsAny(work.workTypeIds, query.workTypeIds)) return false;
  if (!containsAny(work.tagIds, query.tagIds)) return false;

  const release = work.releaseDate?.value;
  if (query.releaseYears?.length) {
    const year = release?.slice(0, 4);
    if (!year || !query.releaseYears.includes(year)) return false;
  }
  if (query.releaseFrom && (!release || release < query.releaseFrom)) return false;
  if (query.releaseTo && (!release || release > query.releaseTo)) return false;

  if (
    query.durationMin !== undefined &&
    (work.durationMinutes === undefined || work.durationMinutes < query.durationMin)
  ) {
    return false;
  }
  if (
    query.durationMax !== undefined &&
    (work.durationMinutes === undefined || work.durationMinutes > query.durationMax)
  ) {
    return false;
  }

  if (query.hasMedia !== undefined) {
    const hasMedia = work.mediaFileIds.length > 0;
    if (hasMedia !== query.hasMedia) return false;
  }

  if (query.hasCover !== undefined) {
    // V1 示例资料中 assetIds 只挂载可展示图片；后续会根据 Asset.type 精确判断。
    const hasCover = work.assetIds.length > 0;
    if (hasCover !== query.hasCover) return false;
  }

  return true;
}

function containsAny(values: string[], expected?: string[]): boolean {
  if (!expected?.length) return true;
  return expected.some((item) => values.includes(item));
}

function containsScalar(value: string | undefined, expected?: string[]): boolean {
  if (!expected?.length) return true;
  return value !== undefined && expected.includes(value);
}

function createWorkComparator(sort: WorkSort = "release_desc") {
  return (a: Work, b: Work): number => {
    switch (sort) {
      case "release_asc":
        return compareText(a.releaseDate?.value, b.releaseDate?.value);
      case "release_desc":
        return compareText(b.releaseDate?.value, a.releaseDate?.value);
      case "created_asc":
        return compareText(a.createdAt, b.createdAt);
      case "created_desc":
        return compareText(b.createdAt, a.createdAt);
      case "updated_asc":
        return compareText(a.updatedAt, b.updatedAt);
      case "updated_desc":
        return compareText(b.updatedAt, a.updatedAt);
      case "code_asc":
        return a.code.localeCompare(b.code, "en");
      case "code_desc":
        return b.code.localeCompare(a.code, "en");
      case "title_asc":
        return getWorkSortTitle(a).localeCompare(getWorkSortTitle(b), "ja");
      case "title_desc":
        return getWorkSortTitle(b).localeCompare(getWorkSortTitle(a), "ja");
      case "duration_asc":
        return (
          (a.durationMinutes ?? Number.MAX_SAFE_INTEGER) -
          (b.durationMinutes ?? Number.MAX_SAFE_INTEGER)
        );
      case "duration_desc":
        return (b.durationMinutes ?? -1) - (a.durationMinutes ?? -1);
    }
  };
}

function buildWorkFacets(works: Work[]): WorkFacets {
  return {
    years: countFacet(
      works.flatMap((work) =>
        work.releaseDate ? [work.releaseDate.value.slice(0, 4)] : [],
      ),
    ),
    people: countFacet(
      works.flatMap((work) =>
        work.personRelations
          .filter((relation) => relation.role === "performer")
          .map((relation) => relation.personId),
      ),
    ),
    directors: countFacet(
      works.flatMap((work) =>
        work.personRelations
          .filter((relation) => relation.role === "director")
          .map((relation) => relation.personId),
      ),
    ),
    makers: countFacet(works.flatMap((work) => (work.makerId ? [work.makerId] : []))),
    labels: countFacet(works.flatMap((work) => (work.labelId ? [work.labelId] : []))),
    series: countFacet(works.flatMap((work) => work.seriesIds)),
    genres: countFacet(works.flatMap((work) => work.genreIds)),
    workTypes: countFacet(works.flatMap((work) => work.workTypeIds)),
    tags: countFacet(works.flatMap((work) => work.tagIds)),
  };
}

function countFacet(values: string[]): FacetCount[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

function getWorkSortTitle(work: Work): string {
  return work.titles.ja ?? work.titles["zh-CN"] ?? work.titles.en ?? work.code;
}

function getPersonSortName(person: Person): string {
  return (
    person.names.find((name) => name.type === "primary" && name.language === "ja")
      ?.value ?? person.names[0]?.value ?? person.id
  );
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function compareText(a: string | undefined, b: string | undefined): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a.localeCompare(b);
}
