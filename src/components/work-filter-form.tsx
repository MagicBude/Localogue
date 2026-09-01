import Link from "next/link";

import type { WorkQuery } from "@/domain/queries/work-query";
import type { UiDictionary } from "@/i18n/ui";
import { UrlQueryForm } from "@/components/url-query-form";

export interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

interface WorkFilterFormProps {
  action: string;
  query: WorkQuery;
  dictionary: UiDictionary;
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
  view?: "grid" | "list" | "table";
}

/**
 * 筛选器保持标准 GET Query 语义，但 V1-04 用 UrlQueryForm 接管导航，
 * 从而在提交“应用筛选”时保留当前滚动位置。
 *
 * 提交后所有条件都会进入 URL，这带来三个好处：
 * 1. 刷新页面不丢筛选条件；
 * 2. 浏览器前进/后退自然可用；
 * 3. 可以直接复制当前筛选结果的 URL。
 *
 * 多个同名 checkbox 会自然形成数组，例如：
 * ?genre=drama&genre=uniform
 */
export function WorkFilterForm({
  action,
  query,
  dictionary,
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
  view = "grid",
}: WorkFilterFormProps) {
  return (
    <aside className="filter-panel">
      <div className="filter-panel__heading">
        <strong>{dictionary.filters}</strong>
        <Link href={action}>{dictionary.clear}</Link>
      </div>

      <UrlQueryForm action={action} className="filter-form">
        {view !== "grid" ? <input name="view" type="hidden" value={view} /> : null}
        {fixedPersonId ? (
          <input name="person" type="hidden" value={fixedPersonId} />
        ) : null}

        <label className="field">
          <span>{dictionary.searchPlaceholder}</span>
          <input defaultValue={query.text ?? ""} name="q" type="search" />
        </label>

        <label className="field">
          <span>{dictionary.sort}</span>
          <select defaultValue={query.sort ?? "release_desc"} name="sort">
            <option value="release_desc">{dictionary.releaseDate} ↓</option>
            <option value="release_asc">{dictionary.releaseDate} ↑</option>
            <option value="duration_desc">{dictionary.duration} ↓</option>
            <option value="duration_asc">{dictionary.duration} ↑</option>
            <option value="code_asc">番号 A → Z</option>
            <option value="code_desc">番号 Z → A</option>
            <option value="title_asc">标题 A → Z</option>
            <option value="title_desc">标题 Z → A</option>
          </select>
        </label>

        <div className="field-row">
          <label className="field">
            <span>{dictionary.dateFrom}</span>
            <input defaultValue={query.releaseFrom ?? ""} name="releaseFrom" type="date" />
          </label>
          <label className="field">
            <span>{dictionary.dateTo}</span>
            <input defaultValue={query.releaseTo ?? ""} name="releaseTo" type="date" />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>{dictionary.duration} ≥</span>
            <input
              defaultValue={query.durationMin ?? ""}
              min="0"
              name="durationMin"
              placeholder="90"
              type="number"
            />
          </label>
          <label className="field">
            <span>{dictionary.duration} ≤</span>
            <input
              defaultValue={query.durationMax ?? ""}
              min="0"
              name="durationMax"
              placeholder="180"
              type="number"
            />
          </label>
        </div>

        <div className="field-row">
          <BooleanSelect
            label={dictionary.hasCover}
            name="hasCover"
            value={query.hasCover}
            dictionary={dictionary}
          />
          <BooleanSelect
            label={dictionary.hasMedia}
            name="hasMedia"
            value={query.hasMedia}
            dictionary={dictionary}
          />
        </div>

        {!fixedPersonId && people.length ? (
          <FilterGroup
            checked={query.personIds}
            label={dictionary.performer}
            name="person"
            options={people}
          />
        ) : null}

        {directors.length ? (
          <FilterGroup
            checked={query.directorIds}
            label={dictionary.director}
            name="director"
            options={directors}
          />
        ) : null}

        {years.length ? (
          <FilterGroup
            checked={query.releaseYears}
            label={dictionary.year}
            name="year"
            options={years}
          />
        ) : null}

        {workTypes.length ? (
          <FilterGroup
            checked={query.workTypeIds}
            label={dictionary.workTypes}
            name="workType"
            options={workTypes}
          />
        ) : null}

        {makers.length ? (
          <FilterGroup
            checked={query.makerIds}
            label={dictionary.maker}
            name="maker"
            options={makers}
          />
        ) : null}

        {labels.length ? (
          <FilterGroup
            checked={query.labelIds}
            label={dictionary.label}
            name="label"
            options={labels}
          />
        ) : null}

        {series.length ? (
          <FilterGroup
            checked={query.seriesIds}
            label={dictionary.series}
            name="series"
            options={series}
          />
        ) : null}

        {genres.length ? (
          <FilterGroup
            checked={query.genreIds}
            label={dictionary.genres}
            name="genre"
            options={genres}
          />
        ) : null}

        {tags.length ? (
          <FilterGroup
            checked={query.tagIds}
            label={dictionary.tags}
            name="tag"
            options={tags}
          />
        ) : null}

        <button className="primary-button" type="submit">
          {dictionary.apply}
        </button>
      </UrlQueryForm>
    </aside>
  );
}

interface BooleanSelectProps {
  label: string;
  name: string;
  value?: boolean;
  dictionary: UiDictionary;
}

function BooleanSelect({ label, name, value, dictionary }: BooleanSelectProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <select defaultValue={value === undefined ? "" : String(value)} name={name}>
        <option value="">{dictionary.any}</option>
        <option value="true">{dictionary.yes}</option>
        <option value="false">{dictionary.no}</option>
      </select>
    </label>
  );
}

interface FilterGroupProps {
  name: string;
  label: string;
  options: FilterOption[];
  checked?: string[];
}

function FilterGroup({
  name,
  label,
  options,
  checked = [],
}: FilterGroupProps) {
  return (
    <details className="filter-group" open={options.length <= 6}>
      <summary>{label}</summary>
      <div className="filter-options">
        {options.map((option) => (
          <label className="check-option" key={option.id}>
            <input
              defaultChecked={checked.includes(option.id)}
              name={name}
              type="checkbox"
              value={option.id}
            />
            <span>{option.label}</span>
            {option.count !== undefined ? <small>{option.count}</small> : null}
          </label>
        ))}
      </div>
    </details>
  );
}
