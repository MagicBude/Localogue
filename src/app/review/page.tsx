import type { Metadata } from "next";
import Link from "next/link";

import { analyzeEvidenceRecords } from "@/application/review/entity-resolution-service";
import { getVocabularyLabelMap } from "@/application/services/vocabulary-service";
import { formatImportWarning } from "@/i18n/import-warnings";
import { getReviewDictionary } from "@/i18n/review";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { vocabularyRepository } from "@/infrastructure/repositories/vocabulary-provider";
import { listEvidenceRecords } from "@/infrastructure/evidence/evidence-store";
import { listCommitReceipts } from "@/infrastructure/evidence/review-commit-store";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "Evidence 审核" };

export default async function ReviewInboxPage() {
  const preferences = await getUserPreferences();
  const text = getReviewDictionary(preferences.uiLanguage);
  const records = await listEvidenceRecords();
  const [analyses, workStatusLabels, receipts] = await Promise.all([
    analyzeEvidenceRecords(records, libraryRepository, vocabularyRepository),
    getVocabularyLabelMap(vocabularyRepository, "review-work-statuses", preferences.uiLanguage),
    listCommitReceipts(),
  ]);
  const committedEvidenceIds = new Set(receipts.map((receipt) => receipt.evidenceId));

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">CURATION · EVIDENCE INBOX</span>
          <h1>{text.inboxTitle}</h1>
          <p className="muted">{text.inboxDescription}</p>
        </div>
        <Link className="secondary-button" href="/import">
          {text.openImport}
        </Link>
      </section>

      {!analyses.length ? (
        <section className="empty-state review-empty-state">
          <h2>{text.empty}</h2>
          <Link className="primary-button" href="/import">
            {text.openImport}
          </Link>
        </section>
      ) : (
        <section className="review-inbox-list">
          {analyses.map((analysis) => (
            <article className="review-inbox-card" key={analysis.evidenceId}>
              <div className="review-inbox-card__main">
                <div className="review-inbox-card__heading">
                  <span className={`review-status review-status--${analysis.workStatus}`}>
                    {workStatusLabels.get(analysis.workStatus) ?? analysis.workStatus}
                  </span>
                  {committedEvidenceIds.has(analysis.evidenceId) ? (
                    <span className="review-status review-status--committed">{text.committed}</span>
                  ) : null}
                  <span className="work-code">{analysis.code ?? "—"}</span>
                </div>
                <h2>{analysis.title ?? analysis.sourceName}</h2>
                <dl className="review-card-meta">
                  <div>
                    <dt>{text.source}</dt>
                    <dd>{analysis.sourceType} · {analysis.sourceName}</dd>
                  </div>
                  <div>
                    <dt>{text.importedAt}</dt>
                    <dd>{formatTimestamp(analysis.importedAt, preferences.uiLanguage)}</dd>
                  </div>
                </dl>
                {analysis.warnings.length ? (
                  <div className="review-warning-summary">
                    <strong>{text.warnings}</strong>
                    <span>
                      {analysis.warnings
                        .slice(0, 2)
                        .map((warning) => formatImportWarning(warning, preferences.uiLanguage))
                        .join(" · ")}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="review-inbox-card__summary">
                <span>{text.matchedEntities}<strong>{analysis.summary.matchedEntities}</strong></span>
                <span>{text.newEntities}<strong>{analysis.summary.newEntities}</strong></span>
                <span>{text.ambiguousEntities}<strong>{analysis.summary.ambiguousEntities}</strong></span>
                <span>{text.conflictingFields}<strong>{analysis.summary.conflictingFields}</strong></span>
              </div>

              <Link
                className="primary-button"
                href={`/review/${encodeURIComponent(analysis.evidenceId)}`}
              >
                {text.openReview}
              </Link>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function formatTimestamp(
  value: string,
  language: "ja" | "zh-CN" | "en",
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const locale = language === "ja" ? "ja-JP" : language === "zh-CN" ? "zh-CN" : "en-US";
  return date.toLocaleString(locale);
}
