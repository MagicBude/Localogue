import Link from "next/link";

import type { FilterOption } from "@/components/work-filter-form";
import type { UiDictionary } from "@/i18n/ui";
import { first, many, type RawSearchParams } from "@/lib/search-params";

interface WorkFilterChipsProps {
  action: string;
  dictionary: UiDictionary;
  searchParams: RawSearchParams;
  people?: FilterOption[];
  directors?: FilterOption[];
  makers?: FilterOption[];
  labels?: FilterOption[];
  series?: FilterOption[];
  workTypes?: FilterOption[];
  genres?: FilterOption[];
  tags?: FilterOption[];
  years?: FilterOption[];
  fixedPersonId?: string;
}

interface ActiveChip {
  key: string;
  value: string;
  label: string;
}

/**
 * 把 URL 中已经生效的筛选条件转换成可见 Chips。
 *
 * 这不仅是视觉优化：用户可以清楚知道“为什么结果只剩这些”，
 * 并且可以只移除某一个条件，而不必回到左侧筛选器逐项查找。
 */
export function WorkFilterChips({
  action,
  dictionary,
  searchParams,
  people = [],
  directors = [],
  makers = [],
  labels = [],
  series = [],
  workTypes = [],
  genres = [],
  tags = [],
  years = [],
  fixedPersonId,
}: WorkFilterChipsProps) {
  const chips: ActiveChip[] = [];
  const optionMaps = {
    person: toLabelMap(people),
    director: toLabelMap(directors),
    maker: toLabelMap(makers),
    label: toLabelMap(labels),
    series: toLabelMap(series),
    workType: toLabelMap(workTypes),
    genre: toLabelMap(genres),
    tag: toLabelMap(tags),
    year: toLabelMap(years),
  };

  pushScalar(chips, searchParams, "q", dictionary.keyword);
  pushMany(chips, searchParams, "person", dictionary.performer, optionMaps.person, fixedPersonId);
  pushMany(chips, searchParams, "director", dictionary.director, optionMaps.director);
  pushMany(chips, searchParams, "maker", dictionary.maker, optionMaps.maker);
  pushMany(chips, searchParams, "label", dictionary.label, optionMaps.label);
  pushMany(chips, searchParams, "series", dictionary.series, optionMaps.series);
  pushMany(chips, searchParams, "workType", dictionary.workTypes, optionMaps.workType);
  pushMany(chips, searchParams, "genre", dictionary.genres, optionMaps.genre);
  pushMany(chips, searchParams, "tag", dictionary.tags, optionMaps.tag);
  pushMany(chips, searchParams, "year", dictionary.year, optionMaps.year);
  pushScalar(chips, searchParams, "releaseFrom", dictionary.dateFrom);
  pushScalar(chips, searchParams, "releaseTo", dictionary.dateTo);
  pushScalar(chips, searchParams, "durationMin", `${dictionary.duration} ≥`);
  pushScalar(chips, searchParams, "durationMax", `${dictionary.duration} ≤`);
  pushBoolean(chips, searchParams, "hasCover", dictionary.hasCover, dictionary);
  pushBoolean(chips, searchParams, "hasMedia", dictionary.hasMedia, dictionary);

  if (!chips.length) return null;

  return (
    <div className="active-filters" aria-label={dictionary.activeFilters}>
      <span className="active-filters__label">{dictionary.activeFilters}</span>
      <div className="active-filters__chips">
        {chips.map((chip) => (
          <Link
            className="filter-chip"
            href={buildRemovedFilterHref(action, searchParams, chip.key, chip.value)}
            key={`${chip.key}-${chip.value}`}
            scroll={false}
          >
            {chip.label}
            <span aria-hidden="true">×</span>
          </Link>
        ))}
      </div>
      <Link className="active-filters__clear" href={action}>
        {dictionary.clearAllFilters}
      </Link>
    </div>
  );
}

function toLabelMap(options: FilterOption[]): Map<string, string> {
  return new Map(options.map((option) => [option.id, option.label]));
}

function pushScalar(
  chips: ActiveChip[],
  params: RawSearchParams,
  key: string,
  label: string,
) {
  const value = first(params[key]);
  if (!value) return;
  chips.push({ key, value, label: `${label}：${value}` });
}

function pushMany(
  chips: ActiveChip[],
  params: RawSearchParams,
  key: string,
  label: string,
  labels: Map<string, string>,
  ignoredValue?: string,
) {
  for (const value of many(params[key]) ?? []) {
    if (value === ignoredValue) continue;
    chips.push({ key, value, label: `${label}：${labels.get(value) ?? value}` });
  }
}

function pushBoolean(
  chips: ActiveChip[],
  params: RawSearchParams,
  key: string,
  label: string,
  dictionary: UiDictionary,
) {
  const value = first(params[key]);
  if (value !== "true" && value !== "false") return;
  chips.push({
    key,
    value,
    label: `${label}：${value === "true" ? dictionary.yes : dictionary.no}`,
  });
}

function buildRemovedFilterHref(
  action: string,
  searchParams: RawSearchParams,
  removedKey: string,
  removedValue: string,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    // 改变筛选条件后回到第 1 页，避免当前页码超出新结果范围。
    if (key === "page" || value === undefined) continue;

    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (key === removedKey && item === removedValue) continue;
      params.append(key, item);
    }
  }

  const query = params.toString();
  return query ? `${action}?${query}` : action;
}
