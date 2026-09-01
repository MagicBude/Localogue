import type { WorkQuery, WorkSort } from "@/domain/queries/work-query";

export type RawSearchParams = Record<
  string,
  string | string[] | undefined
>;

/**
 * URL 查询参数是“不可信的字符串输入”，Domain Query 则应拥有明确类型。
 * 这一层负责把两者隔开，避免筛选解析逻辑散落在页面组件中。
 */
export function parseWorkQuery(
  params: RawSearchParams,
  defaults: Partial<WorkQuery> = {},
): WorkQuery {
  return {
    ...defaults,
    text: first(params.q),
    personIds: many(params.person),
    directorIds: many(params.director),
    makerIds: many(params.maker),
    labelIds: many(params.label),
    seriesIds: many(params.series),
    genreIds: many(params.genre),
    workTypeIds: many(params.workType),
    tagIds: many(params.tag),
    releaseYears: many(params.year),
    releaseFrom: first(params.releaseFrom),
    releaseTo: first(params.releaseTo),
    durationMin: toOptionalNumber(first(params.durationMin)),
    durationMax: toOptionalNumber(first(params.durationMax)),
    hasMedia: toOptionalBoolean(first(params.hasMedia)),
    hasCover: toOptionalBoolean(first(params.hasCover)),
    sort: toWorkSort(first(params.sort)) ?? defaults.sort ?? "release_desc",
    page: toOptionalNumber(first(params.page)) ?? defaults.page ?? 1,
    pageSize: defaults.pageSize ?? 24,
  };
}

export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function many(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

function toOptionalNumber(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function toOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function toWorkSort(value: string | undefined): WorkSort | undefined {
  const allowed: WorkSort[] = [
    "release_desc",
    "release_asc",
    "created_desc",
    "created_asc",
    "updated_desc",
    "updated_asc",
    "code_asc",
    "code_desc",
    "title_asc",
    "title_desc",
    "duration_asc",
    "duration_desc",
  ];

  return allowed.includes(value as WorkSort) ? (value as WorkSort) : undefined;
}
