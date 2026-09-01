import type { Metadata } from "next";

import { getPreferredPersonName } from "@/application/services/localization-service";
import { presentPersonCard } from "@/application/services/person-presentation-service";
import { getVocabularyLabelMap } from "@/application/services/vocabulary-service";
import { EmptyState } from "@/components/empty-state";
import { PersonCard } from "@/components/person-card";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { vocabularyRepository } from "@/infrastructure/repositories/vocabulary-provider";
import { getUserPreferences } from "@/lib/preferences";
import { first, many, type RawSearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "人物库" };

interface PeoplePageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function PeoplePage({ searchParams }: PeoplePageProps) {
  const [params, preferences] = await Promise.all([
    searchParams,
    getUserPreferences(),
  ]);
  const dictionary = getUiDictionary(preferences.uiLanguage);
  const statusIds = many(params.status);

  const [peopleResult, allWorks, statusLabels] = await Promise.all([
    libraryRepository.listPeople({
      text: first(params.q),
      statuses: statusIds,
      page: 1,
      pageSize: 9999,
    }),
    libraryRepository.listWorks({ page: 1, pageSize: 9999 }),
    getVocabularyLabelMap(
      vocabularyRepository,
      "person-statuses",
      preferences.uiLanguage,
    ),
  ]);

  // 当前 UI 的“演员库”只展示以 performer 角色出现的人物。
  // Person Domain 本身仍然统一保存演员、导演等人物角色。
  const performerIds = new Set(
    allWorks.items.flatMap((work) =>
      work.personRelations
        .filter((relation) => relation.role === "performer")
        .map((relation) => relation.personId),
    ),
  );
  const performers = peopleResult.items.filter((person) => performerIds.has(person.id));
  const cards = await Promise.all(
    performers.map((person) =>
      presentPersonCard(
        libraryRepository,
        person,
        preferences.metadataLanguage,
      ),
    ),
  );

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">PEOPLE · PROFILE</span>
          <h1>{dictionary.allPeople}</h1>
          <p className="muted">
            {cards.length} {dictionary.resultCount}
          </p>
        </div>
      </section>

      <form action="/people" className="toolbar" method="get">
        <label className="field field--grow">
          <span>{dictionary.searchPlaceholder}</span>
          <input defaultValue={first(params.q) ?? ""} name="q" type="search" />
        </label>
        <label className="field">
          <span>{dictionary.status}</span>
          <select defaultValue={statusIds?.[0] ?? ""} name="status">
            <option value="">全部</option>
            {[...statusLabels.entries()].map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-button" type="submit">
          {dictionary.apply}
        </button>
      </form>

      {cards.length ? (
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
      ) : (
        <EmptyState message={dictionary.noResults} />
      )}

      <section className="learning-panel">
        <h2>为什么底层叫 Person，而页面叫演员？</h2>
        <p>
          因为数据库模型应该表达真实实体，而 UI 应该表达用户正在做的事情。同一个 Person
          未来可能既是演员又是导演，所以不应该复制成两条人物记录。
        </p>
        <p className="muted">
          当前示例包含 {getPreferredPersonName(performers[0]!, preferences.metadataLanguage)} 等虚构人物。
        </p>
      </section>
    </div>
  );
}
