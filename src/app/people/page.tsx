import type { Metadata } from "next";

import { presentPersonCard } from "@/application/services/person-presentation-service";
import { getVocabularyLabelMap } from "@/application/services/vocabulary-service";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { PersonCard } from "@/components/person-card";
import {
  PersonFilterForm,
  type PersonFilterOption,
} from "@/components/person-filter-form";
import type { Person } from "@/domain/entities/person";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { vocabularyRepository } from "@/infrastructure/repositories/vocabulary-provider";
import { getUserPreferences } from "@/lib/preferences";
import {
  parsePersonQuery,
  type RawSearchParams,
} from "@/lib/search-params";

export const metadata: Metadata = { title: "人物库" };

const PERSON_PAGE_SIZE = 24;

interface PeoplePageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function PeoplePage({ searchParams }: PeoplePageProps) {
  const [params, preferences] = await Promise.all([
    searchParams,
    getUserPreferences(),
  ]);
  const dictionary = getUiDictionary(preferences.uiLanguage);
  const query = parsePersonQuery(params, { pageSize: PERSON_PAGE_SIZE });

  const [filteredPeople, allPeopleResult, allWorks, statusLabels] =
    await Promise.all([
      // 先让 Repository 完成姓名、状态、年份、身高与排序等 Domain Query。
      // 当前 JSON 版再在页面层按 performer 角色收口；V2 SQLite 会把角色也纳入查询层。
      libraryRepository.listPeople({ ...query, page: 1, pageSize: 9999 }),
      libraryRepository.listPeople({ page: 1, pageSize: 9999 }),
      libraryRepository.listWorks({ page: 1, pageSize: 9999 }),
      getVocabularyLabelMap(
        vocabularyRepository,
        "person-statuses",
        preferences.uiLanguage,
      ),
    ]);

  const performerIds = new Set(
    allWorks.items.flatMap((work) =>
      work.personRelations
        .filter((relation) => relation.role === "performer")
        .map((relation) => relation.personId),
    ),
  );

  const allPerformers = allPeopleResult.items.filter((person) =>
    performerIds.has(person.id),
  );
  const filteredPerformers = filteredPeople.items.filter((person) =>
    performerIds.has(person.id),
  );

  const requestedPage = Math.max(1, query.page ?? 1);
  const pageCount = Math.max(1, Math.ceil(filteredPerformers.length / PERSON_PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pageCount);
  const start = (currentPage - 1) * PERSON_PAGE_SIZE;
  const visiblePerformers = filteredPerformers.slice(
    start,
    start + PERSON_PAGE_SIZE,
  );

  const cards = await Promise.all(
    visiblePerformers.map((person) =>
      presentPersonCard(
        libraryRepository,
        person,
        preferences.metadataLanguage,
      ),
    ),
  );

  const statusOptions: PersonFilterOption[] = [...statusLabels.entries()].map(
    ([id, label]) => ({ id, label }),
  );
  const birthYearOptions = toYearOptions(
    allPerformers.map((person) => person.birthDate?.value),
  );
  const debutYearOptions = toYearOptions(
    allPerformers.map((person) => getCareerEventDate(person, "debut")),
  );
  const retirementYearOptions = toYearOptions(
    allPerformers.map((person) => getCareerEventDate(person, "retirement")),
  );

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">PEOPLE · PROFILE · FILTER</span>
          <h1>{dictionary.allPeople}</h1>
          <p className="muted">
            {filteredPerformers.length} {dictionary.resultCount}
          </p>
        </div>
      </section>

      <PersonFilterForm
        action="/people"
        birthYears={birthYearOptions}
        debutYears={debutYearOptions}
        dictionary={dictionary}
        query={query}
        retirementYears={retirementYearOptions}
        statuses={statusOptions}
      />

      <section id="people-results">
        {cards.length ? (
          <>
            <div className="person-grid">
              {cards.map((person) => (
                <PersonCard
                  id={person.id}
                  key={person.id}
                  name={person.name}
                  portraitPath={person.portraitPath}
                  secondaryName={person.secondaryName}
                  status={statusLabels.get(person.status) ?? person.status}
                  workCount={person.workCount}
                  worksLabel={dictionary.works}
                />
              ))}
            </div>

            <Pagination
              action="/people"
              anchorId="people-results"
              dictionary={dictionary}
              page={currentPage}
              pageSize={PERSON_PAGE_SIZE}
              searchParams={params}
              total={filteredPerformers.length}
            />
          </>
        ) : (
          <EmptyState message={dictionary.noResults} />
        )}
      </section>

      <section className="learning-panel">
        <h2>为什么人物筛选也使用 URL？</h2>
        <p>
          因为姓名、状态、出道年份、出生年份、身高和排序本质上都是“查询条件”。
          把它们放在 URL 中，可以直接看到浏览器如何把用户输入转换成查询参数；
          V2 使用 SQLite 时，这些参数再映射成 WHERE 与 ORDER BY。
        </p>
      </section>
    </div>
  );
}

function toYearOptions(values: Array<string | undefined>): PersonFilterOption[] {
  const years = new Set(
    values
      .filter((value): value is string => Boolean(value))
      .map((value) => value.slice(0, 4)),
  );

  return [...years]
    .sort((a, b) => b.localeCompare(a))
    .map((year) => ({ id: year, label: year }));
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
