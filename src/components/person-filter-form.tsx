import Link from "next/link";

import type { PersonQuery } from "@/domain/queries/person-query";
import type { UiDictionary } from "@/i18n/ui";
import { UrlQueryForm } from "@/components/url-query-form";

export interface PersonFilterOption {
  id: string;
  label: string;
}

interface PersonFilterFormProps {
  action: string;
  dictionary: UiDictionary;
  query: PersonQuery;
  statuses: PersonFilterOption[];
  birthYears: PersonFilterOption[];
  debutYears: PersonFilterOption[];
  retirementYears: PersonFilterOption[];
}

/**
 * 人物库高级筛选器。
 *
 * 这里仍然使用普通 GET Form：筛选条件最终都进入 URL。
 * 这是学习 Web 表单与查询字符串最直接的方式，也方便未来把同一套参数映射到 SQLite。
 */
export function PersonFilterForm({
  action,
  dictionary,
  query,
  statuses,
  birthYears,
  debutYears,
  retirementYears,
}: PersonFilterFormProps) {
  return (
    <UrlQueryForm action={action} className="person-filter-panel">
      <div className="person-filter-panel__heading">
        <strong>{dictionary.peopleFilters}</strong>
        <Link href={action}>{dictionary.clear}</Link>
      </div>

      <div className="person-filter-grid">
        <label className="field field--wide">
          <span>{dictionary.personSearchPlaceholder}</span>
          <input defaultValue={query.text ?? ""} name="q" type="search" />
        </label>

        <label className="field">
          <span>{dictionary.status}</span>
          <select defaultValue={query.statuses?.[0] ?? ""} name="status">
            <option value="">{dictionary.any}</option>
            {statuses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{dictionary.debutYear}</span>
          <select defaultValue={query.debutYears?.[0] ?? ""} name="debutYear">
            <option value="">{dictionary.any}</option>
            {debutYears.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{dictionary.retirementYear}</span>
          <select
            defaultValue={query.retirementYears?.[0] ?? ""}
            name="retirementYear"
          >
            <option value="">{dictionary.any}</option>
            {retirementYears.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{dictionary.birthYear}</span>
          <select defaultValue={query.birthYears?.[0] ?? ""} name="birthYear">
            <option value="">{dictionary.any}</option>
            {birthYears.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{dictionary.height} ≥</span>
          <input
            defaultValue={query.heightMin ?? ""}
            min="0"
            name="heightMin"
            placeholder="150"
            type="number"
          />
        </label>

        <label className="field">
          <span>{dictionary.height} ≤</span>
          <input
            defaultValue={query.heightMax ?? ""}
            min="0"
            name="heightMax"
            placeholder="175"
            type="number"
          />
        </label>

        <label className="field">
          <span>{dictionary.sort}</span>
          <select defaultValue={query.sort ?? "name_asc"} name="sort">
            <option value="name_asc">{dictionary.personName} A → Z</option>
            <option value="name_desc">{dictionary.personName} Z → A</option>
            <option value="debut_desc">{dictionary.debutYear} ↓</option>
            <option value="debut_asc">{dictionary.debutYear} ↑</option>
            <option value="birth_desc">{dictionary.birthYear} ↓</option>
            <option value="birth_asc">{dictionary.birthYear} ↑</option>
            <option value="height_desc">{dictionary.height} ↓</option>
            <option value="height_asc">{dictionary.height} ↑</option>
          </select>
        </label>

        <button className="primary-button person-filter-panel__submit" type="submit">
          {dictionary.apply}
        </button>
      </div>
    </UrlQueryForm>
  );
}
