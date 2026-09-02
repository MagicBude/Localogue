import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { checkRestoreEligibility } from "@/application/history/restore-service";
import { HistoryRestoreWorkbench } from "@/components/history-restore-workbench";
import { getHistoryDictionary } from "@/i18n/history";
import { formatReviewField } from "@/i18n/review";
import { findEvidenceRecordById } from "@/infrastructure/evidence/evidence-store";
import { findCommitReceiptById } from "@/infrastructure/evidence/review-commit-store";
import { findRestoreReceiptByCommitId } from "@/infrastructure/history/restore-receipt-store";
import { listProvenanceEventsByCommitId } from "@/infrastructure/provenance/work-provenance-store";
import { isPrivateLibraryConfigured, libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { getUserPreferences } from "@/lib/preferences";

interface HistoryDetailPageProps { params: Promise<{ id: string }> }

export const metadata: Metadata = { title: "提交历史详情" };

export default async function HistoryDetailPage({ params }: HistoryDetailPageProps) {
  const { id } = await params;
  const commit = await findCommitReceiptById(id);
  if (!commit) notFound();

  const preferences = await getUserPreferences();
  const text = getHistoryDictionary(preferences.uiLanguage);
  const privateConfigured = isPrivateLibraryConfigured();
  const [evidence, provenanceEvents, restoreReceipt, currentWork, eligibility] = await Promise.all([
    findEvidenceRecordById(commit.evidenceId),
    listProvenanceEventsByCommitId(commit.id),
    findRestoreReceiptByCommitId(commit.id),
    libraryRepository.findWorkById(commit.targetWorkId),
    privateConfigured
      ? checkRestoreEligibility(commit, libraryRepository)
      : Promise.resolve({ allowed: false, blockers: [], snapshot: null }),
  ]);

  return (
    <div className="page-stack">
      <section className="review-detail-hero">
        <div>
          <div className="review-detail-hero__badges">
            <span className={`history-status history-status--${restoreReceipt ? "restored" : commit.snapshotId ? "active" : "legacy"}`}>
              {restoreReceipt ? text.restored : commit.snapshotId ? text.active : text.legacy}
            </span>
            <span className="work-code">{commit.targetWorkCode}</span>
          </div>
          <h1>{commit.id}</h1>
          <p className="muted">{text.committedAt}: {formatTimestamp(commit.committedAt, preferences.uiLanguage)}</p>
        </div>
        <div className="review-detail-actions">
          <Link className="secondary-button" href="/history">← {text.title}</Link>
          {currentWork ? (
            <Link className="primary-button" href={`/works/${commit.targetWorkId}`}>{text.openWork}</Link>
          ) : null}
        </div>
      </section>

      <section className="review-summary-grid">
        <HistoryMetric label={text.operations} value={commit.operationCount} />
        <HistoryMetric label="Schema" value={commit.schemaVersion} />
        <HistoryMetric label={text.snapshot} value={commit.snapshotId ? 1 : 0} />
        <HistoryMetric label={text.provenance} value={provenanceEvents.length} />
      </section>

      <section className="detail-section history-metadata">
        <h2>{text.evidence}</h2>
        <dl className="work-facts">
          <div><dt>ID</dt><dd><code>{commit.evidenceId}</code></dd></div>
          <div><dt>Source</dt><dd>{evidence ? `${evidence.sourceType} · ${evidence.sourceName}` : "—"}</dd></div>
          <div><dt>Fingerprint</dt><dd><code>{commit.fingerprint}</code></dd></div>
          <div><dt>Snapshot</dt><dd><code>{commit.snapshotId ?? "—"}</code></dd></div>
        </dl>
      </section>

      <section className="detail-section">
        <h2>{text.operationDetail}</h2>
        {commit.operations?.length ? (
          <div className="commit-operation-list">
            {commit.operations.map((operation, index) => (
              <article key={`${operation.kind}-${operation.entityId}-${index}`}>
                <code>{operation.kind}</code>
                <div><strong>{operation.label}</strong><p>{operation.detail}</p></div>
              </article>
            ))}
          </div>
        ) : <p className="muted">{text.legacy}</p>}
      </section>

      <section className="detail-section">
        <h2>{text.provenance}</h2>
        {provenanceEvents.length ? (
          <div className="table-scroll-shell">
            <table className="review-comparison-table history-provenance-table">
              <thead><tr><th>{text.field}</th><th>{text.eventType}</th><th>{text.source}</th><th>{text.recordedAt}</th></tr></thead>
              <tbody>
                {provenanceEvents.map((event) => (
                  <tr key={event.id}>
                    <th>{formatReviewField(event.field, preferences.uiLanguage)}</th>
                    <td>{event.eventType === "adopted" ? text.adopted : text.restoredEvent}</td>
                    <td>{event.sourceName ?? event.evidenceId ?? "—"}</td>
                    <td>{formatTimestamp(event.recordedAt, preferences.uiLanguage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">{text.noProvenance}</p>}
      </section>

      <HistoryRestoreWorkbench
        commitReceiptId={commit.id}
        targetWorkCode={commit.targetWorkCode}
        language={preferences.uiLanguage}
        allowed={eligibility.allowed}
        blockers={eligibility.blockers}
        alreadyRestored={Boolean(restoreReceipt)}
        privateLibraryConfigured={privateConfigured}
      />
    </div>
  );
}

function HistoryMetric({ label, value }: { label: string; value: number }) {
  return <div className="review-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function formatTimestamp(value: string, language: "ja" | "zh-CN" | "en") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === "ja" ? "ja-JP" : language === "zh-CN" ? "zh-CN" : "en-US");
}
