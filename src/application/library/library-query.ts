import type { Asset } from "@/domain/entities/asset";
import type { MediaFile } from "@/domain/entities/media-file";
import type { Person } from "@/domain/entities/person";
import type { Work } from "@/domain/entities/work";
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

const DEFAULT_PAGE_SIZE = 24;

/**
 * JSON Repository 与 Tauri Repository 共用的纯内存查询核心。
 *
 * 这里不依赖 Node/Tauri/React，只负责把已经读取到内存的 Canonical Entity
 * 做过滤、排序、分页与 Facet 计算。这样 Web 和 Desktop 不会各维护一套
 * “搜索结果为什么不一样”的隐性业务规则。
 */
export function queryWorks(
  works: readonly Work[],
  query: WorkQuery = {},
  mediaFiles: readonly MediaFile[] = [],
  assets: readonly Asset[] = [],
): WorkSearchResult {
  const mediaWorkIds = new Set(
    mediaFiles.flatMap((item) => (item.workId ? [item.workId] : [])),
  );
  const subjectCoverWorkIds = new Set(
    assets
      .filter(
        (item) =>
          item.subjectType === "work" && ["cover", "poster"].includes(item.type),
      )
      .flatMap((item) => (item.subjectId ? [item.subjectId] : [])),
  );

  const filtered = works.filter((work) =>
    matchesWork(work, query, mediaWorkIds, subjectCoverWorkIds),
  );
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
    facets: buildWorkFacets(
      [...works],
      query,
      mediaWorkIds,
      subjectCoverWorkIds,
    ),
  };
}

export function queryPeople(
  people: readonly Person[],
  query: PersonQuery = {},
): PersonSearchResult {
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
    if (!matchesCareerEventYear(person, "retirement", query.retirementYears)) {
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
      const searchable = person.names
        .map((name) => name.value)
        .join(" ")
        .toLocaleLowerCase();
      if (!searchable.includes(text)) return false;
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

function matchesWork(
  work: Work,
  query: WorkQuery,
  mediaWorkIds: ReadonlySet<string> = new Set(),
  subjectCoverWorkIds: ReadonlySet<string> = new Set(),
): boolean {
  if (query.text) {
    const needle = query.text.trim().toLocaleLowerCase();
    const titles = Object.values(work.titles).filter(Boolean).join(" ");
    const searchable = `${work.code} ${titles}`.toLocaleLowerCase();
    if (!searchable.includes(needle)) return false;
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
    (work.durationMinutes === undefined ||
      work.durationMinutes < query.durationMin)
  ) {
    return false;
  }
  if (
    query.durationMax !== undefined &&
    (work.durationMinutes === undefined ||
      work.durationMinutes > query.durationMax)
  ) {
    return false;
  }

  if (query.hasMedia !== undefined) {
    const hasMedia = mediaWorkIds.has(work.id) || work.mediaFileIds.length > 0;
    if (hasMedia !== query.hasMedia) return false;
  }

  if (query.hasCover !== undefined) {
    const hasCover = work.assetIds.length > 0 || subjectCoverWorkIds.has(work.id);
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

function buildWorkFacets(
  works: Work[],
  query: WorkQuery,
  mediaWorkIds: ReadonlySet<string>,
  subjectCoverWorkIds: ReadonlySet<string>,
): WorkFacets {
  const facetWorks = (ignoredKeys: Array<keyof WorkQuery>) => {
    const facetQuery = { ...query };
    for (const key of ignoredKeys) delete facetQuery[key];
    delete facetQuery.sort;
    delete facetQuery.page;
    delete facetQuery.pageSize;
    return works.filter((work) =>
      matchesWork(work, facetQuery, mediaWorkIds, subjectCoverWorkIds),
    );
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
    tags: countFacet(facetWorks(["tagIds"]).flatMap((work) => work.tagIds)),
  };
}

function countFacet(values: string[]): FacetCount[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
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
        return (
          (a.heightCm ?? Number.MAX_SAFE_INTEGER) -
          (b.heightCm ?? Number.MAX_SAFE_INTEGER)
        );
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
    person.names.find(
      (name) => name.type === "primary" && name.language === "ja",
    )?.value ??
    person.names[0]?.value ??
    person.id
  );
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isInteger(value) || value <= 0) return fallback;
  return value;
}

function compareText(a: string | undefined, b: string | undefined): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a.localeCompare(b);
}
