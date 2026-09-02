import type { Metadata } from "next";
import Link from "next/link";

import { getHistoryDictionary } from "@/i18n/history";
import { listCommitReceipts } from "@/infrastructure/evidence/review-commit-store";
import { listRestoreReceipts } from "@/infrastructure/history/restore-receipt-store";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "提交历史" };

export default async function HistoryPage() {
  const preferences = await getUserPreferences();
  const text = getHistoryDictionary(preferences.uiLanguage);
  const [commits, restores] = await Promise.all([
    listCommitReceipts(),
    listRestoreReceipts(),
  ]);
  const restoredCommitIds = new Set(restores.map((item) => item.commitReceiptId));

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">CURATION · AUDIT HISTORY</span>
          <h1>{text.title}</h1>
          <p className="muted">{text.description}</p>
        </div>
      </section>

      {!commits.length ? (
        <section className="empty-state"><h2>{text.empty}</h2></section>
      ) : (
        <section className="history-list">
          {commits.map((commit) => {
            const restored = restoredCommitIds.has(commit.id);
            const status = restored ? text.restored : commit.snapshotId ? text.active : text.legacy;
            return (
              <article className="history-card" key={commit.id}>
                <div className="history-card__main">
                  <div className="review-inbox-card__heading">
                    <span className={`history-status history-status--${restored ? "restored" : commit.snapshotId ? "active" : "legacy"}`}>
                      {status}
                    </span>
                    <span className="work-code">{commit.targetWorkCode}</span>
                  </div>
                  <h2>{commit.id}</h2>
                  <dl className="review-card-meta">
                    <div><dt>{text.committedAt}</dt><dd>{formatTimestamp(commit.committedAt, preferences.uiLanguage)}</dd></div>
                    <div><dt>{text.operations}</dt><dd>{commit.operationCount}</dd></div>
                    <div><dt>{text.evidence}</dt><dd><code>{commit.evidenceId}</code></dd></div>
                  </dl>
                </div>
                <Link className="primary-button" href={`/history/${encodeURIComponent(commit.id)}`}>
                  {text.open}
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function formatTimestamp(value: string, language: "ja" | "zh-CN" | "en") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === "ja" ? "ja-JP" : language === "zh-CN" ? "zh-CN" : "en-US");
}
