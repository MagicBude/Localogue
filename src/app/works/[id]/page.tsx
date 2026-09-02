import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { assetDisplayUrl, listWorkAssets } from "@/application/assets/presentation-asset-service";
import { localizeText } from "@/application/services/localization-service";
import { presentWorkDetail } from "@/application/services/work-presentation-service";
import { AssetPreferenceWorkbench } from "@/components/asset-preference-workbench";
import { getVocabularyLabelMap } from "@/application/services/vocabulary-service";
import { getHistoryDictionary } from "@/i18n/history";
import { formatReviewField } from "@/i18n/review";
import { getUiDictionary } from "@/i18n/ui";
import { listLatestWorkFieldProvenance } from "@/infrastructure/provenance/work-provenance-store";
import { isPrivateLibraryConfigured, libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { getPresentationPreference } from "@/infrastructure/presentation/presentation-preference-store";
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
  const historyText = getHistoryDictionary(preferences.uiLanguage);
  const [view, workTypeLabels, genres, tags, provenance, workAssets, mediaFiles, presentationPreference] = await Promise.all([
    presentWorkDetail(libraryRepository, work, preferences.metadataLanguage),
    getVocabularyLabelMap(
      vocabularyRepository,
      "work-types",
      preferences.metadataLanguage,
    ),
    libraryRepository.listGenres(),
    libraryRepository.listTags(),
    listLatestWorkFieldProvenance(work.id),
    listWorkAssets(libraryRepository, work),
    libraryRepository.listMediaFiles(work.id),
    getPresentationPreference("work", work.id),
  ]);
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
          {view.posterPath ? (
            <Image
              alt=""
              fill
              unoptimized
              priority
              sizes="(max-width: 760px) 90vw, 360px"
              src={view.posterPath}
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

      {provenance.size ? (
        <section className="detail-section">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">PROVENANCE</span>
              <h2>{historyText.provenance}</h2>
            </div>
            <Link className="secondary-button" href="/history">{historyText.title}</Link>
          </div>
          <div className="provenance-grid">
            {[...provenance.values()].map((event) => (
              <article className="provenance-card" key={event.id}>
                <strong>{formatReviewField(event.field, preferences.uiLanguage)}</strong>
                <span>{event.sourceName ?? (event.eventType === "restored" ? historyText.restoredEvent : event.evidenceId ?? "—")}</span>
                <small>{formatTimestamp(event.recordedAt, preferences.uiLanguage)}</small>
                {event.commitId ? <Link href={`/history/${event.commitId}`}>{event.commitId.slice(0, 24)}…</Link> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

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

      <AssetPreferenceWorkbench
        candidates={workAssets.map((asset) => ({ id: asset.id, type: asset.type, url: assetDisplayUrl(asset), width: asset.width, height: asset.height, fileSize: asset.fileSize }))}
        entityId={work.id}
        entityType="work"
        language={preferences.uiLanguage}
        preferredAssetId={presentationPreference?.preferredCoverAssetId}
        activeAssetId={view.posterAssetId}
        writable={isPrivateLibraryConfigured()}
      />

      <section className="detail-section">
        <h2>{dictionary.localFiles}</h2>
        {mediaFiles.length ? <div className="media-file-cards">
          {mediaFiles.map((file) => <article className="media-file-card" key={file.id}>
            <div><strong>{file.fileName}</strong><small className="path-text">{file.path}</small></div>
            <dl>
              <div><dt>Size</dt><dd>{formatBytes(file.fileSize ?? 0)}</dd></div>
              <div><dt>Actual duration</dt><dd>{file.durationSeconds ? formatDuration(file.durationSeconds) : "—"}</dd></div>
              <div><dt>Resolution</dt><dd>{file.width && file.height ? `${file.width}×${file.height}` : "—"}</dd></div>
              <div><dt>Codec</dt><dd>{[file.videoCodec, file.audioCodec].filter(Boolean).join(" / ") || "—"}</dd></div>
              <div><dt>SHA-256</dt><dd><code>{file.sha256 ? `${file.sha256.slice(0, 16)}…` : "—"}</code></dd></div>
            </dl>
          </article>)}
        </div> : <p className="muted">当前没有匹配到本地媒体文件。Work 与 MediaFile 保持分离，可在“媒体”页面扫描目录。</p>}
      </section>
    </article>
  );
}

function formatTimestamp(value: string, language: "ja" | "zh-CN" | "en") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === "ja" ? "ja-JP" : language === "zh-CN" ? "zh-CN" : "en-US");
}

function formatBytes(value: number): string {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 2 ? 2 : 1)} ${units[index]}`;
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return [hours, minutes, remainder].map((item, index) => index === 0 ? String(item) : String(item).padStart(2, "0")).join(":");
}
