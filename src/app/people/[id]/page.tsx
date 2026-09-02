import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getNamesByType,
  getPreferredPersonName,
  localizeText,
} from "@/application/services/localization-service";
import { presentWorkCard } from "@/application/services/work-presentation-service";
import { getVocabularyLabelMap } from "@/application/services/vocabulary-service";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { WorkFilterChips } from "@/components/work-filter-chips";
import { WorkFilterForm } from "@/components/work-filter-form";
import { WorkResults } from "@/components/work-results";
import { parseWorkView, WorkViewSwitcher } from "@/components/work-view-switcher";
import { getCurationDictionary } from "@/i18n/curation";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { vocabularyRepository } from "@/infrastructure/repositories/vocabulary-provider";
import { formatMeasurements, formatPartialDate } from "@/lib/format";
import { getUserPreferences } from "@/lib/preferences";
import { parseWorkQuery, type RawSearchParams } from "@/lib/search-params";

interface PersonDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({
  params,
}: PersonDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const person = await libraryRepository.findPersonById(id);
  const name = person?.names.find((item) => item.type === "primary")?.value;
  return { title: name ?? "人物详情" };
}

export default async function PersonDetailPage({
  params,
  searchParams,
}: PersonDetailPageProps) {
  const [{ id }, rawParams, preferences] = await Promise.all([
    params,
    searchParams,
    getUserPreferences(),
  ]);
  const person = await libraryRepository.findPersonById(id);
  if (!person) notFound();

  const dictionary = getUiDictionary(preferences.uiLanguage);
  const curationText = getCurationDictionary(preferences.uiLanguage);
  const view = parseWorkView(rawParams.view);
  const query = parseWorkQuery(rawParams, {
    personIds: [person.id],
    pageSize: 24,
    sort: "release_desc",
  });
  // 即使 URL 中没有 person 参数，也强制当前人物作为查询前提。
  query.personIds = [person.id];

  const [
    workResult,
    portrait,
    statusLabels,
    eventLabels,
    nameTypeLabels,
    workTypeLabels,
    organizations,
    series,
    genres,
    tags,
    peopleResult,
  ] = await Promise.all([
      libraryRepository.listWorks(query),
      person.portraitAssetId
        ? libraryRepository.findAssetById(person.portraitAssetId)
        : Promise.resolve(null),
      getVocabularyLabelMap(
        vocabularyRepository,
        "person-statuses",
        preferences.uiLanguage,
      ),
      getVocabularyLabelMap(
        vocabularyRepository,
        "career-events",
        preferences.uiLanguage,
      ),
      getVocabularyLabelMap(
        vocabularyRepository,
        "person-name-types",
        preferences.uiLanguage,
      ),
      getVocabularyLabelMap(
        vocabularyRepository,
        "work-types",
        preferences.metadataLanguage,
      ),
      libraryRepository.listOrganizations(),
      libraryRepository.listSeries(),
      libraryRepository.listGenres(),
      libraryRepository.listTags(),
      libraryRepository.listPeople({ page: 1, pageSize: 9999 }),
    ]);

  const cards = await Promise.all(
    workResult.items.map((work) =>
      presentWorkCard(libraryRepository, work, preferences.metadataLanguage),
    ),
  );

  const displayName = getPreferredPersonName(person, preferences.metadataLanguage);
  const aliases = getNamesByType(person, [
    "alias",
    "former_name",
    "stage_name",
    "alternate",
  ]);


  const directorIds = new Set(workResult.facets.directors.map((facet) => facet.id));
  const directorOptions = peopleResult.items
    .filter((item) =>
      directorIds.has(item.id) || query.directorIds?.includes(item.id),
    )
    .map((item) => ({
      id: item.id,
      label: getPreferredPersonName(item, preferences.metadataLanguage),
      count: workResult.facets.directors.find((facet) => facet.id === item.id)?.count ?? 0,
    }));

  const labelOptions = organizations
    .filter((item) => item.kind === "label")
    .map((item) => ({
      id: item.id,
      label: localizeText(item.names, preferences.metadataLanguage, item.id),
      count: workResult.facets.labels.find((facet) => facet.id === item.id)?.count ?? 0,
    }));

  const tagOptions = tags.map((item) => ({
    id: item.id,
    label: localizeText(item.names, preferences.metadataLanguage, item.id),
    count: workResult.facets.tags.find((facet) => facet.id === item.id)?.count ?? 0,
  }));

  const makerOptions = organizations
    .filter((item) => item.kind === "maker")
    .map((item) => ({
      id: item.id,
      label: localizeText(item.names, preferences.metadataLanguage, item.id),
      count: workResult.facets.makers.find((facet) => facet.id === item.id)?.count ?? 0,
    }));
  const seriesOptions = series.map((item) => ({
    id: item.id,
    label: localizeText(item.names, preferences.metadataLanguage, item.id),
    count: workResult.facets.series.find((facet) => facet.id === item.id)?.count ?? 0,
  }));
  const genreOptions = genres.map((item) => ({
    id: item.id,
    label: localizeText(item.names, preferences.metadataLanguage, item.id),
    count: workResult.facets.genres.find((facet) => facet.id === item.id)?.count ?? 0,
  }));
  const typeOptions = [...workTypeLabels.entries()].map(([typeId, label]) => ({
    id: typeId,
    label,
    count: workResult.facets.workTypes.find((facet) => facet.id === typeId)?.count ?? 0,
  }));
  const yearOptions = workResult.facets.years.map((facet) => ({
    id: facet.id,
    label: facet.id,
    count: facet.count,
  }));

  return (
    <div className="page-stack">
      <section className="person-profile-hero">
        <div className="person-profile-portrait">
          {portrait ? (
            <Image
              alt=""
              fill
              unoptimized
              priority
              sizes="(max-width: 760px) 90vw, 320px"
              src={portrait.storagePath}
            />
          ) : (
            <div className="portrait-placeholder">{displayName.slice(0, 1)}</div>
          )}
        </div>

        <div className="person-profile-copy">
          <span className="status-badge">
            {statusLabels.get(person.activityStatus) ?? person.activityStatus}
          </span>
          <div className="person-profile-title-row">
            <h1>{displayName}</h1>
            <Link className="secondary-button" href={`/people/${encodeURIComponent(person.id)}/edit`}>{curationText.editPerson}</Link>
          </div>
          <div className="name-stack">
            {person.names
              .filter((name) => ["primary", "localized", "romanized"].includes(name.type))
              .map((name) => (
                <span key={`${name.type}-${name.language}-${name.value}`}>
                  <small>{nameTypeLabels.get(name.type) ?? name.type}</small>
                  {name.value}
                </span>
              ))}
          </div>

          <dl className="profile-facts">
            <div>
              <dt>{dictionary.birthDate}</dt>
              <dd>{formatPartialDate(person.birthDate)}</dd>
            </div>
            <div>
              <dt>{dictionary.birthPlace}</dt>
              <dd>{localizeText(person.birthPlace, preferences.metadataLanguage)}</dd>
            </div>
            <div>
              <dt>{dictionary.height}</dt>
              <dd>{person.heightCm ? `${person.heightCm} cm` : "—"}</dd>
            </div>
            <div>
              <dt>{dictionary.measurements}</dt>
              <dd>{formatMeasurements(person.measurements)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="profile-columns">
        <section className="detail-section">
          <h2>{dictionary.biography}</h2>
          <p>{localizeText(person.biographies, preferences.metadataLanguage)}</p>
        </section>

        <section className="detail-section">
          <h2>{dictionary.aliases}</h2>
          {aliases.length ? (
            <div className="name-history">
              {aliases.map((name) => (
                <div key={`${name.type}-${name.language}-${name.value}`}>
                  <span>{nameTypeLabels.get(name.type) ?? name.type}</span>
                  <strong>{name.value}</strong>
                  <small>
                    {[name.validFrom, name.validTo].filter(Boolean).join(" → ")}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">—</p>
          )}
        </section>
      </div>

      <section className="detail-section">
        <h2>{dictionary.careerTimeline}</h2>
        <ol className="timeline">
          {[...person.careerEvents]
            .sort((a, b) => (a.date?.value ?? "").localeCompare(b.date?.value ?? ""))
            .map((event, index) => (
              <li key={`${event.type}-${event.date?.value ?? index}`}>
                <time>{formatPartialDate(event.date)}</time>
                <div>
                  <strong>{eventLabels.get(event.type) ?? event.type}</strong>
                  {event.note ? <p>{event.note}</p> : null}
                </div>
              </li>
            ))}
        </ol>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">WORK TIMELINE</span>
            <h2>{dictionary.relatedWorks}</h2>
            <p className="muted">
              {workResult.total} {dictionary.resultCount}
            </p>
          </div>
        </div>

        <div className="library-layout">
          <WorkFilterForm
            action={`/people/${person.id}`}
            dictionary={dictionary}
            directors={directorOptions}
            fixedPersonId={person.id}
            genres={genreOptions}
            labels={labelOptions}
            makers={makerOptions}
            query={query}
            series={seriesOptions}
            tags={tagOptions}
            workTypes={typeOptions}
            years={yearOptions}
            view={view}
          />

          <section className="results-panel" id="person-work-results">
            <WorkFilterChips
              action={`/people/${person.id}`}
              dictionary={dictionary}
              directors={directorOptions}
              fixedPersonId={person.id}
              genres={genreOptions}
              labels={labelOptions}
              makers={makerOptions}
              searchParams={rawParams}
              series={seriesOptions}
              tags={tagOptions}
              workTypes={typeOptions}
              years={yearOptions}
            />

            <div className="results-toolbar">
              <p className="muted">
                {dictionary.viewMode} · {workResult.total} {dictionary.resultCount}
              </p>
              <WorkViewSwitcher
                action={`/people/${person.id}`}
                current={view}
                dictionary={dictionary}
                searchParams={rawParams}
              />
            </div>

            {cards.length ? (
              <>
                <WorkResults
                  dictionary={dictionary}
                  view={view}
                  works={cards}
                  workTypeLabels={workTypeLabels}
                />
                <Pagination
                  action={`/people/${person.id}`}
                  anchorId="person-work-results"
                  dictionary={dictionary}
                  page={workResult.page}
                  pageSize={workResult.pageSize}
                  searchParams={rawParams}
                  total={workResult.total}
                />
              </>
            ) : (
              <EmptyState message={dictionary.noResults} />
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
