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
  PersonSort,
} from "@/domain/queries/person-query";
import type {
  FacetCount,
  WorkFacets,
  WorkQuery,
  WorkSearchResult,
  WorkSort,
} from "@/domain/queries/work-query";
import { JsonFileStore, type JsonStoreRoots } from "@/infrastructure/repositories/json-file-store";

const DEFAULT_PAGE_SIZE = 24;

/**
 * V1 的文件化 Repository。
 *
 * 重要：上层只依赖 LibraryRepository 接口。
 * 未来 V2 的 SqliteLibraryRepository 会实现同一个接口，页面不需要知道数据源已经改变。
 */
export class JsonLibraryRepository implements LibraryRepository {
  private readonly store: JsonFileStore;

  constructor(
    readRoots: JsonStoreRoots = path.join(process.cwd(), "data", "library"),
    private readonly writableRoot: string | (() => string | null) = path.join(process.cwd(), "data", "library"),
  ) {
    this.store = new JsonFileStore(readRoots);
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
    const requestedPage = positiveInteger(query.page, 1);
    const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
    const page = Math.min(requestedPage, pageCount);
    const start = (page - 1) * pageSize;

    return {
      items: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page,
      pageSize,
      facets: buildWorkFacets(works, query),
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

      if (!matchesYear(person.birthDate?.value, query.birthYears)) return false;
      if (!matchesCareerEventYear(person, "debut", query.debutYears)) return false;
      if (
        !matchesCareerEventYear(person, "retirement", query.retirementYears)
      ) {
        return false;
      }

      if (
        query.heightMin !== undefined &&
        (person.heightCm === undefined || person.heightCm < query.heightMin)
      ) {
        return false;
      }

      if (
        query.heightMax !== undefined &&
        (person.heightCm === undefined || person.heightCm > query.heightMax)
      ) {
        return false;
      }

      if (text) {
        // 所有姓名类型都进入搜索范围，因此正式名、译名、罗马字、旧艺名和别名都可搜索。
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

    filtered.sort(createPersonComparator(query.sort));

    const pageSize = positiveInteger(query.pageSize, DEFAULT_PAGE_SIZE);
    const requestedPage = positiveInteger(query.page, 1);
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(requestedPage, pageCount);
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
    return this.writer().writeEntity("works", work);
  }

  savePerson(person: Person): Promise<void> {
    return this.writer().writeEntity("people", person);
  }

  saveOrganization(organization: Organization): Promise<void> {
    return this.writer().writeEntity("organizations", organization);
  }

  saveSeries(series: Series): Promise<void> {
    return this.writer().writeEntity("series", series);
  }

  saveGenre(genre: Genre): Promise<void> {
    return this.writer().writeEntity("genres", genre);
  }

  saveTag(tag: Tag): Promise<void> {
    return this.writer().writeEntity("tags", tag);
  }

  private writer(): JsonFileStore {
    const root = typeof this.writableRoot === "function" ? this.writableRoot() : this.writableRoot;
    if (!root) {
      throw new Error("当前没有配置可写私人资料库；Shared Pack 与 Demo Library 都是只读的。");
    }
    return new JsonFileStore(root);
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

function buildWorkFacets(works: Work[], query: WorkQuery): WorkFacets {
  /**
   * Faceted Navigation 的计数不能简单基于“最终筛选结果”计算。
   *
   * 例：用户已经勾选 Maker A，如果 Maker facet 也基于最终结果统计，
   * Maker B/C 会变成 0 或直接消失，用户就很难继续切换或组合条件。
   *
   * 标准做法是：计算某个维度时，只临时忽略“这个维度自身”的条件，
   * 但保留其它所有筛选条件。这种计数常被称为 self-excluding facets。
   */
  const facetWorks = (ignoredKeys: Array<keyof WorkQuery>) => {
    const facetQuery = { ...query };
    for (const key of ignoredKeys) {
      delete facetQuery[key];
    }
    // 排序和分页不影响 facet，本身也无需参与匹配。
    delete facetQuery.sort;
    delete facetQuery.page;
    delete facetQuery.pageSize;
    return works.filter((work) => matchesWork(work, facetQuery));
  };

  return {
    years: countFacet(
      facetWorks(["releaseYears"]).flatMap((work) =>
        work.releaseDate ? [work.releaseDate.value.slice(0, 4)] : [],
      ),
    ),
    people: countFacet(
      facetWorks(["personIds"]).flatMap((work) =>
        work.personRelations
          .filter((relation) => relation.role === "performer")
          .map((relation) => relation.personId),
      ),
    ),
    directors: countFacet(
      facetWorks(["directorIds"]).flatMap((work) =>
        work.personRelations
          .filter((relation) => relation.role === "director")
          .map((relation) => relation.personId),
      ),
    ),
    makers: countFacet(
      facetWorks(["makerIds"]).flatMap((work) =>
        work.makerId ? [work.makerId] : [],
      ),
    ),
    labels: countFacet(
      facetWorks(["labelIds"]).flatMap((work) =>
        work.labelId ? [work.labelId] : [],
      ),
    ),
    series: countFacet(
      facetWorks(["seriesIds"]).flatMap((work) => work.seriesIds),
    ),
    genres: countFacet(
      facetWorks(["genreIds"]).flatMap((work) => work.genreIds),
    ),
    workTypes: countFacet(
      facetWorks(["workTypeIds"]).flatMap((work) => work.workTypeIds),
    ),
    tags: countFacet(
      facetWorks(["tagIds"]).flatMap((work) => work.tagIds),
    ),
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

function createPersonComparator(sort: PersonSort = "name_asc") {
  return (a: Person, b: Person): number => {
    switch (sort) {
      case "name_asc":
        return getPersonSortName(a).localeCompare(getPersonSortName(b), "ja");
      case "name_desc":
        return getPersonSortName(b).localeCompare(getPersonSortName(a), "ja");
      case "birth_asc":
        return compareText(a.birthDate?.value, b.birthDate?.value);
      case "birth_desc":
        return compareText(b.birthDate?.value, a.birthDate?.value);
      case "debut_asc":
        return compareText(
          getCareerEventDate(a, "debut"),
          getCareerEventDate(b, "debut"),
        );
      case "debut_desc":
        return compareText(
          getCareerEventDate(b, "debut"),
          getCareerEventDate(a, "debut"),
        );
      case "height_asc":
        return (a.heightCm ?? Number.MAX_SAFE_INTEGER) - (b.heightCm ?? Number.MAX_SAFE_INTEGER);
      case "height_desc":
        return (b.heightCm ?? -1) - (a.heightCm ?? -1);
    }
  };
}

function getCareerEventDate(
  person: Person,
  type: Person["careerEvents"][number]["type"],
): string | undefined {
  return person.careerEvents
    .filter((event) => event.type === type && event.date?.value)
    .map((event) => event.date!.value)
    .sort()[0];
}

function matchesYear(value: string | undefined, years?: string[]): boolean {
  if (!years?.length) return true;
  return value !== undefined && years.includes(value.slice(0, 4));
}

function matchesCareerEventYear(
  person: Person,
  type: Person["careerEvents"][number]["type"],
  years?: string[],
): boolean {
  if (!years?.length) return true;

  return person.careerEvents.some(
    (event) =>
      event.type === type &&
      event.date?.value !== undefined &&
      years.includes(event.date.value.slice(0, 4)),
  );
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
