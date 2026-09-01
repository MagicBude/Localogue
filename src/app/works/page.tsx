import type { Metadata } from "next";

import { getPreferredPersonName, localizeText } from "@/application/services/localization-service";
import { presentWorkCard } from "@/application/services/work-presentation-service";
import { getVocabularyLabelMap } from "@/application/services/vocabulary-service";
import { EmptyState } from "@/components/empty-state";
import {
  type FilterOption,
  WorkFilterForm,
} from "@/components/work-filter-form";
import { WorkCard } from "@/components/work-card";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { vocabularyRepository } from "@/infrastructure/repositories/vocabulary-provider";
import { getUserPreferences } from "@/lib/preferences";
import { parseWorkQuery, type RawSearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "作品库" };

interface WorksPageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function WorksPage({ searchParams }: WorksPageProps) {
  const [rawParams, preferences] = await Promise.all([
    searchParams,
    getUserPreferences(),
  ]);
  const dictionary = getUiDictionary(preferences.uiLanguage);
  const query = parseWorkQuery(rawParams, { pageSize: 48 });

  const [result, peopleResult, organizations, series, genres, tags, workTypeLabels] =
    await Promise.all([
      libraryRepository.listWorks(query),
      libraryRepository.listPeople({ page: 1, pageSize: 9999 }),
      libraryRepository.listOrganizations(),
      libraryRepository.listSeries(),
      libraryRepository.listGenres(),
      libraryRepository.listTags(),
      getVocabularyLabelMap(
        vocabularyRepository,
        "work-types",
        preferences.metadataLanguage,
      ),
    ]);

  const workCards = await Promise.all(
    result.items.map((work) =>
      presentWorkCard(libraryRepository, work, preferences.metadataLanguage),
    ),
  );

  const performerIds = new Set(result.facets.people.map((item) => item.id));
  const peopleOptions: FilterOption[] = peopleResult.items
    .filter((person) => performerIds.has(person.id) || query.personIds?.includes(person.id))
    .map((person) => ({
      id: person.id,
      label: getPreferredPersonName(person, preferences.metadataLanguage),
      count: result.facets.people.find((facet) => facet.id === person.id)?.count ?? 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ja"));


  const directorIds = new Set(result.facets.directors?.map((item) => item.id) ?? []);
  const directorOptions: FilterOption[] = peopleResult.items
    .filter((person) =>
      directorIds.has(person.id) || query.directorIds?.includes(person.id),
    )
    .map((person) => ({
      id: person.id,
      label: getPreferredPersonName(person, preferences.metadataLanguage),
      count: result.facets.directors?.find((facet) => facet.id === person.id)?.count ?? 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ja"));

  const makerOptions = organizations
    .filter((item) => item.kind === "maker")
    .map((item) => ({
      id: item.id,
      label: localizeText(item.names, preferences.metadataLanguage, item.id),
      count: result.facets.makers.find((facet) => facet.id === item.id)?.count ?? 0,
    }));


  const labelOptions = organizations
    .filter((item) => item.kind === "label")
    .map((item) => ({
      id: item.id,
      label: localizeText(item.names, preferences.metadataLanguage, item.id),
      count: result.facets.labels.find((facet) => facet.id === item.id)?.count ?? 0,
    }));

  const seriesOptions = series.map((item) => ({
    id: item.id,
    label: localizeText(item.names, preferences.metadataLanguage, item.id),
    count: result.facets.series.find((facet) => facet.id === item.id)?.count ?? 0,
  }));

  const genreOptions = genres.map((item) => ({
    id: item.id,
    label: localizeText(item.names, preferences.metadataLanguage, item.id),
    count: result.facets.genres.find((facet) => facet.id === item.id)?.count ?? 0,
  }));


  const tagOptions = tags.map((item) => ({
    id: item.id,
    label: localizeText(item.names, preferences.metadataLanguage, item.id),
    count: result.facets.tags.find((facet) => facet.id === item.id)?.count ?? 0,
  }));

  const workTypeOptions = [...workTypeLabels.entries()].map(([id, label]) => ({
    id,
    label,
    count: result.facets.workTypes.find((facet) => facet.id === id)?.count ?? 0,
  }));

  const yearOptions = result.facets.years.map((facet) => ({
    id: facet.id,
    label: facet.id,
    count: facet.count,
  }));

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">EXPLORE · FACETED SEARCH</span>
          <h1>{dictionary.allWorks}</h1>
          <p className="muted">
            {result.total} {dictionary.resultCount}
          </p>
        </div>
      </section>

      <div className="library-layout">
        <WorkFilterForm
          action="/works"
          dictionary={dictionary}
          directors={directorOptions}
          genres={genreOptions}
          labels={labelOptions}
          makers={makerOptions}
          people={peopleOptions}
          query={query}
          series={seriesOptions}
          tags={tagOptions}
          workTypes={workTypeOptions}
          years={yearOptions}
        />

        <section>
          {workCards.length ? (
            <div className="work-grid work-grid--library">
              {workCards.map((work) => (
                <WorkCard
                  dictionary={dictionary}
                  key={work.id}
                  work={work}
                  workTypeLabels={work.workTypeIds.map(
                    (id) => workTypeLabels.get(id) ?? id,
                  )}
                />
              ))}
            </div>
          ) : (
            <EmptyState message={dictionary.noResults} />
          )}
        </section>
      </div>
    </div>
  );
}
