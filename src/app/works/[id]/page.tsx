import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { localizeText } from "@/application/services/localization-service";
import { presentWorkDetail } from "@/application/services/work-presentation-service";
import { getVocabularyLabelMap } from "@/application/services/vocabulary-service";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { vocabularyRepository } from "@/infrastructure/repositories/vocabulary-provider";
import { getUserPreferences } from "@/lib/preferences";

interface WorkDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: WorkDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const work = await libraryRepository.findWorkById(id);
  return { title: work?.code ?? "作品详情" };
}

export default async function WorkDetailPage({ params }: WorkDetailPageProps) {
  const [{ id }, preferences] = await Promise.all([params, getUserPreferences()]);
  const work = await libraryRepository.findWorkById(id);
  if (!work) notFound();

  const dictionary = getUiDictionary(preferences.uiLanguage);
  const [view, workTypeLabels, genres, tags] = await Promise.all([
    presentWorkDetail(libraryRepository, work, preferences.metadataLanguage),
    getVocabularyLabelMap(
      vocabularyRepository,
      "work-types",
      preferences.metadataLanguage,
    ),
    libraryRepository.listGenres(),
    libraryRepository.listTags(),
  ]);

  const poster = view.assets.find(
    (asset) => asset.type === "poster" || asset.type === "cover",
  );
  const genreMap = new Map(
    genres.map((item) => [
      item.id,
      localizeText(item.names, preferences.metadataLanguage, item.id),
    ]),
  );
  const tagMap = new Map(
    tags.map((item) => [
      item.id,
      localizeText(item.names, preferences.metadataLanguage, item.id),
    ]),
  );

  return (
    <article className="page-stack">
      <section className="work-detail-hero">
        <div className="work-detail-poster">
          {poster ? (
            <Image
              alt=""
              fill
              unoptimized
              priority
              sizes="(max-width: 760px) 90vw, 360px"
              src={poster.storagePath}
            />
          ) : (
            <div className="poster-placeholder">{view.code}</div>
          )}
        </div>

        <div className="work-detail-copy">
          <span className="work-code">{view.code}</span>
          <h1>{view.title}</h1>
          <div className="chip-row">
            {view.workTypeIds.map((id) => (
              <span className="chip chip--strong" key={id}>
                {workTypeLabels.get(id) ?? id}
              </span>
            ))}
          </div>

          <dl className="detail-list">
            <div>
              <dt>{dictionary.releaseDate}</dt>
              <dd>{view.releaseDate}</dd>
            </div>
            <div>
              <dt>{dictionary.duration}</dt>
              <dd>
                {view.durationMinutes !== undefined
                  ? `${view.durationMinutes} ${dictionary.minutes}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>{dictionary.performer}</dt>
              <dd className="inline-links">
                {view.performers.length
                  ? view.performers.map((person) => (
                      <Link href={`/people/${person.id}`} key={person.id}>
                        {person.name}
                      </Link>
                    ))
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>{dictionary.director}</dt>
              <dd className="inline-links">
                {view.directors.length
                  ? view.directors.map((person) => (
                      <Link href={`/people/${person.id}`} key={person.id}>
                        {person.name}
                      </Link>
                    ))
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>{dictionary.maker}</dt>
              <dd>
                {view.maker
                  ? localizeText(
                      view.maker.names,
                      preferences.metadataLanguage,
                      view.maker.id,
                    )
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>{dictionary.label}</dt>
              <dd>
                {view.label
                  ? localizeText(
                      view.label.names,
                      preferences.metadataLanguage,
                      view.label.id,
                    )
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>{dictionary.series}</dt>
              <dd>
                {view.series.length
                  ? view.series
                      .map((item) =>
                        localizeText(
                          item.names,
                          preferences.metadataLanguage,
                          item.id,
                        ),
                      )
                      .join(" · ")
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="detail-section">
        <h2>{dictionary.description}</h2>
        <p>{view.description}</p>
      </section>

      <section className="detail-section detail-section--split">
        <div>
          <h2>{dictionary.genres}</h2>
          <div className="chip-row">
            {view.genreIds.map((id) => (
              <Link className="chip" href={`/works?genre=${id}`} key={id}>
                {genreMap.get(id) ?? id}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2>{dictionary.tags}</h2>
          <div className="chip-row">
            {view.tagIds.map((id) => (
              <span className="chip" key={id}>
                {tagMap.get(id) ?? id}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="detail-section">
        <h2>{dictionary.localFiles}</h2>
        <p className="muted">
          {view.mediaFileIds.length
            ? `${view.mediaFileIds.length} file(s)`
            : "当前示例只收录作品元数据，没有绑定本地媒体文件。Work 与 MediaFile 保持分离。"}
        </p>
      </section>
    </article>
  );
}
