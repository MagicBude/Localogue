import type { Metadata } from "next";
import Link from "next/link";

import { analyzeEvidenceRecords } from "@/application/review/entity-resolution-service";
import { getVocabularyLabelMap } from "@/application/services/vocabulary-service";
import type { EvidenceLifecycleStatus } from "@/domain/entities/evidence-lifecycle";
import { formatImportWarning } from "@/i18n/import-warnings";
import { getLifecycleDictionary } from "@/i18n/lifecycle";
import { getReviewDictionary } from "@/i18n/review";
import { listEvidenceLifecycles } from "@/infrastructure/evidence/evidence-lifecycle-store";
import { listEvidenceRecords } from "@/infrastructure/evidence/evidence-store";
import { listCommitReceipts } from "@/infrastructure/evidence/review-commit-store";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { vocabularyRepository } from "@/infrastructure/repositories/vocabulary-provider";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "Evidence 审核" };

interface ReviewInboxPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function ReviewInboxPage({ searchParams }: ReviewInboxPageProps) {
  const [preferences, query] = await Promise.all([getUserPreferences(), searchParams]);
  const text = getReviewDictionary(preferences.uiLanguage);
  const lifecycleText = getLifecycleDictionary(preferences.uiLanguage);
  const [records, lifecycles, receipts, workStatusLabels] = await Promise.all([
    listEvidenceRecords(),
    listEvidenceLifecycles(),
    listCommitReceipts(),
    getVocabularyLabelMap(vocabularyRepository, "review-work-statuses", preferences.uiLanguage),
  ]);

  const committedEvidenceIds = new Set(receipts.map((receipt) => receipt.evidenceId));
  const lifecycleMap = new Map(lifecycles.map((item) => [item.evidenceId, item.status]));
  const statusOf = (evidenceId: string): EvidenceLifecycleStatus =>
    lifecycleMap.get(evidenceId) ?? (committedEvidenceIds.has(evidenceId) ? "committed" : "pending");

  const requestedStatus = isLifecycleFilter(query.status) ? query.status : "pending";
  const counts = {
    all: records.length,
    pending: records.filter((item) => statusOf(item.id) === "pending").length,
    committed: records.filter((item) => statusOf(item.id) === "committed").length,
    ignored: records.filter((item) => statusOf(item.id) === "ignored").length,
  };
  const visibleRecords = requestedStatus === "all"
    ? records
    : records.filter((item) => statusOf(item.id) === requestedStatus);
  const analyses = await analyzeEvidenceRecords(visibleRecords, libraryRepository, vocabularyRepository);

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">CURATION · EVIDENCE INBOX</span>
          <h1>{text.inboxTitle}</h1>
          <p className="muted">{text.inboxDescription}</p>
        </div>
        <Link className="secondary-button" href="/import">{text.openImport}</Link>
      </section>

      <nav className="lifecycle-filter-bar" aria-label="Evidence lifecycle filter">
        {(["pending", "committed", "ignored", "all"] as const).map((status) => (
          <Link
            className={requestedStatus === status ? "chip chip--strong" : "chip"}
            href={status === "pending" ? "/review" : `/review?status=${status}`}
            key={status}
          >
            {status === "all" ? lifecycleText.all : lifecycleText[status]} <strong>{counts[status]}</strong>
          </Link>
        ))}
      </nav>

      {!analyses.length ? (
        <section className="empty-state review-empty-state">
          <h2>{text.empty}</h2>
          <Link className="primary-button" href="/import">{text.openImport}</Link>
        </section>
      ) : (
        <section className="review-inbox-list">
          {analyses.map((analysis) => {
            const lifecycleStatus = statusOf(analysis.evidenceId);
            return (
              <article className="review-inbox-card" key={analysis.evidenceId}>
                <div className="review-inbox-card__main">
                  <div className="review-inbox-card__heading">
                    <span className={`review-status review-status--${analysis.workStatus}`}>
                      {workStatusLabels.get(analysis.workStatus) ?? analysis.workStatus}
                    </span>
                    <span className={`history-status history-status--${lifecycleStatus}`}>
                      {lifecycleText[lifecycleStatus]}
                    </span>
                    <span className="work-code">{analysis.code ?? "—"}</span>
                  </div>
                  <h2>{analysis.title ?? analysis.sourceName}</h2>
                  <dl className="review-card-meta">
                    <div><dt>{text.source}</dt><dd>{analysis.sourceType} · {analysis.sourceName}</dd></div>
                    <div><dt>{text.importedAt}</dt><dd>{formatTimestamp(analysis.importedAt, preferences.uiLanguage)}</dd></div>
                  </dl>
                  {analysis.warnings.length ? (
                    <div className="review-warning-summary">
                      <strong>{text.warnings}</strong>
                      <span>{analysis.warnings.slice(0, 2).map((warning) => formatImportWarning(warning, preferences.uiLanguage)).join(" · ")}</span>
                    </div>
                  ) : null}
                </div>

                <div className="review-inbox-card__summary">
                  <span>{text.matchedEntities}<strong>{analysis.summary.matchedEntities}</strong></span>
                  <span>{text.newEntities}<strong>{analysis.summary.newEntities}</strong></span>
                  <span>{text.ambiguousEntities}<strong>{analysis.summary.ambiguousEntities}</strong></span>
                  <span>{text.conflictingFields}<strong>{analysis.summary.conflictingFields}</strong></span>
                </div>

                <Link className="primary-button" href={`/review/${encodeURIComponent(analysis.evidenceId)}`}>
                  {text.openReview}
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function isLifecycleFilter(value: string | undefined): value is EvidenceLifecycleStatus | "all" {
  return value === "pending" || value === "committed" || value === "ignored" || value === "all";
}

function formatTimestamp(value: string, language: "ja" | "zh-CN" | "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale = language === "ja" ? "ja-JP" : language === "zh-CN" ? "zh-CN" : "en-US";
  return date.toLocaleString(locale);
}
