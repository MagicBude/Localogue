import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { analyzeSingleEvidenceRecord } from "@/application/review/entity-resolution-service";
import { EvidenceLifecycleActions } from "@/components/evidence-lifecycle-actions";
import { ReviewCommitWorkbench } from "@/components/review-commit-workbench";
import { getVocabularyLabelMap } from "@/application/services/vocabulary-service";
import type {
  EntityResolution,
  ReviewFieldValue,
} from "@/domain/entities/review";
import { formatImportWarning } from "@/i18n/import-warnings";
import { formatReviewField, getReviewDictionary } from "@/i18n/review";
import { findEvidenceRecordById } from "@/infrastructure/evidence/evidence-store";
import { getEvidenceLifecycle } from "@/infrastructure/evidence/evidence-lifecycle-store";
import { findLatestActiveCommitReceiptByEvidenceId } from "@/infrastructure/evidence/review-commit-store";
import {
  isPrivateLibraryConfigured,
  libraryRepository,
} from "@/infrastructure/repositories/repository-provider";
import { vocabularyRepository } from "@/infrastructure/repositories/vocabulary-provider";
import { getUserPreferences } from "@/lib/preferences";

interface ReviewDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Evidence 审核详情" };

export default async function ReviewDetailPage({ params }: ReviewDetailPageProps) {
  const { id } = await params;
  const evidence = await findEvidenceRecordById(id);
  if (!evidence) notFound();

  const preferences = await getUserPreferences();
  const text = getReviewDictionary(preferences.uiLanguage);
  const [analysis, workStatusLabels, entityStatusLabels, comparisonStatusLabels, receipt, lifecycle] = await Promise.all([
    analyzeSingleEvidenceRecord(evidence, libraryRepository, vocabularyRepository),
    getVocabularyLabelMap(vocabularyRepository, "review-work-statuses", preferences.uiLanguage),
    getVocabularyLabelMap(vocabularyRepository, "entity-resolution-statuses", preferences.uiLanguage),
    getVocabularyLabelMap(vocabularyRepository, "field-comparison-statuses", preferences.uiLanguage),
    findLatestActiveCommitReceiptByEvidenceId(evidence.id),
    getEvidenceLifecycle(evidence.id),
  ]);

  return (
    <div className="page-stack">
      <section className="review-detail-hero">
        <div>
          <div className="review-detail-hero__badges">
            <span className={`review-status review-status--${analysis.workStatus}`}>
              {workStatusLabels.get(analysis.workStatus) ?? analysis.workStatus}
            </span>
            <span className="work-code">{analysis.code ?? "—"}</span>
          </div>
          <h1>{analysis.title ?? analysis.sourceName}</h1>
          <p className="muted">
            {text.source}: {analysis.sourceType} · {analysis.sourceName}
          </p>
        </div>
        <div className="review-detail-actions">
          <Link className="secondary-button" href="/review">← {text.inboxTitle}</Link>
          {analysis.matchedWorkId ? (
            <Link className="primary-button" href={`/works/${analysis.matchedWorkId}`}>
              {text.canonicalWork}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="learning-panel review-safety-panel">
        <h2>{text.analysisOnlyTitle}</h2>
        <p>{text.analysisOnlyBody}</p>
      </section>

      <section className="review-summary-grid" aria-label={text.resolutionSummary}>
        <ReviewMetric label={text.matchedEntities} value={analysis.summary.matchedEntities} />
        <ReviewMetric label={text.newEntities} value={analysis.summary.newEntities} />
        <ReviewMetric label={text.ambiguousEntities} value={analysis.summary.ambiguousEntities} />
        <ReviewMetric label={text.unresolvedEntities} value={analysis.summary.unresolvedEntities} />
        <ReviewMetric label={text.conflictingFields} value={analysis.summary.conflictingFields} />
        <ReviewMetric label={text.warnings} value={analysis.warnings.length} />
      </section>

      {analysis.warnings.length ? (
        <section className="detail-section">
          <h2>{text.warnings}</h2>
          <ul className="review-warning-list">
            {analysis.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>
                {formatImportWarning(warning, preferences.uiLanguage)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {analysis.comparisons.length ? (
        <section className="detail-section">
          <h2>{text.compareTitle}</h2>
          <div className="table-scroll-shell">
            <table className="review-comparison-table">
              <thead>
                <tr>
                  <th>{preferences.uiLanguage === "zh-CN" ? "字段" : preferences.uiLanguage === "ja" ? "フィールド" : "Field"}</th>
                  <th>{text.evidenceValue}</th>
                  <th>{text.libraryValue}</th>
                  <th>{preferences.uiLanguage === "zh-CN" ? "判断" : preferences.uiLanguage === "ja" ? "判定" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {analysis.comparisons.map((comparison) => (
                  <tr key={comparison.field}>
                    <th>{formatReviewField(comparison.field, preferences.uiLanguage)}</th>
                    <td>{renderReviewValue(comparison.evidenceValue)}</td>
                    <td>{renderReviewValue(comparison.libraryValue)}</td>
                    <td>
                      <span className={`comparison-status comparison-status--${comparison.status}`}>
                        {comparisonStatusLabels.get(comparison.status) ?? comparison.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="detail-section">
        <h2>{text.entityResolution}</h2>
        <div className="resolution-groups">
          <ResolutionGroup title={text.peoplePerformers} values={analysis.performers} emptyLabel={text.noValues} candidateLabel={text.candidates} statusLabels={entityStatusLabels} />
          <ResolutionGroup title={text.peopleDirectors} values={analysis.directors} emptyLabel={text.noValues} candidateLabel={text.candidates} statusLabels={entityStatusLabels} />
          <ResolutionGroup title={text.maker} values={analysis.maker ? [analysis.maker] : []} emptyLabel={text.noValues} candidateLabel={text.candidates} statusLabels={entityStatusLabels} />
          <ResolutionGroup title={text.label} values={analysis.label ? [analysis.label] : []} emptyLabel={text.noValues} candidateLabel={text.candidates} statusLabels={entityStatusLabels} />
          <ResolutionGroup title={text.series} values={analysis.series} emptyLabel={text.noValues} candidateLabel={text.candidates} statusLabels={entityStatusLabels} />
          <ResolutionGroup title={text.genres} values={analysis.genres} emptyLabel={text.noValues} candidateLabel={text.candidates} statusLabels={entityStatusLabels} />
          <ResolutionGroup title={text.workTypes} values={analysis.workTypes} emptyLabel={text.noValues} candidateLabel={text.candidates} statusLabels={entityStatusLabels} />
          <ResolutionGroup title={text.tags} values={analysis.tags} emptyLabel={text.noValues} candidateLabel={text.candidates} statusLabels={entityStatusLabels} />
        </div>
      </section>

      <EvidenceLifecycleActions
        evidenceId={evidence.id}
        status={lifecycle.status}
        language={preferences.uiLanguage}
      />

      <ReviewCommitWorkbench
        analysis={analysis}
        language={preferences.uiLanguage}
        privateLibraryConfigured={isPrivateLibraryConfigured()}
        existingReceipt={receipt}
        lifecycleStatus={lifecycle.status}
      />

      <section className="detail-section review-raw-data">
        <h2>Evidence</h2>
        <details>
          <summary>Normalized</summary>
          <pre>{JSON.stringify(evidence.normalized, null, 2)}</pre>
        </details>
        <details>
          <summary>Raw</summary>
          <pre>{JSON.stringify(evidence.raw, null, 2)}</pre>
        </details>
      </section>
    </div>
  );
}

function ReviewMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="review-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ResolutionGroup({
  title,
  values,
  emptyLabel,
  candidateLabel,
  statusLabels,
}: {
  title: string;
  values: EntityResolution[];
  emptyLabel: string;
  candidateLabel: string;
  statusLabels: Map<string, string>;
}) {
  return (
    <section className="resolution-group">
      <h3>{title}</h3>
      {!values.length ? <p className="muted">{emptyLabel}</p> : null}
      {values.map((resolution, index) => (
        <article className="resolution-row" key={`${resolution.sourceValue}-${index}`}>
          <div>
            <strong>{resolution.sourceValue}</strong>
            {resolution.matchedLabel && resolution.matchedLabel !== resolution.sourceValue ? (
              <span className="muted">→ {resolution.matchedLabel}</span>
            ) : null}
          </div>
          <span className={`resolution-status resolution-status--${resolution.status}`}>
            {statusLabels.get(resolution.status) ?? resolution.status}
          </span>
          {resolution.candidates.length > 1 ? (
            <div className="resolution-candidates">
              <small>{candidateLabel}</small>
              {resolution.candidates.map((candidate) => (
                <span key={candidate.id}>{candidate.label} <code>{candidate.id}</code></span>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function renderReviewValue(value: ReviewFieldValue): string {
  if (value === null) return "—";
  if (Array.isArray(value)) return value.length ? value.join(" / ") : "—";
  return String(value);
}
