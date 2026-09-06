import { useEffect, useMemo, useState } from "react";

import { buildRestoredProvenanceEvents } from "@/application/provenance/work-provenance-service";
import type { CanonicalCommitReceipt } from "@/domain/entities/commit-plan";
import type { WorkProvenanceLog } from "@/domain/entities/provenance";
import type { CanonicalRestoreReceipt } from "@/domain/entities/snapshot";
import type { Work } from "@/domain/entities/work";

import { useDesktopI18n } from "./desktop-i18n";
import { GovernanceTitle } from "./desktop-page-primitives";
import { desktopBridge } from "./tauri-bridge";

/**
 * History 页面封装完整恢复用例：Restore Snapshot -> Restore Receipt -> Provenance。
 * 顺序必须保持连续；页面组件负责协调，Native Boundary 负责受限文件恢复。
 */
export function DesktopHistoryPage({ privateRoot, onLibraryChanged, setMessage, openWork }: { privateRoot: string; onLibraryChanged: () => void; setMessage: (value: string) => void; openWork: (id: string) => void }) {
  const { t } = useDesktopI18n();
  const [commits, setCommits] = useState<CanonicalCommitReceipt[]>([]);
  const [restores, setRestores] = useState<CanonicalRestoreReceipt[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  async function reload(): Promise<void> {
    const [nextCommits, nextRestores] = await Promise.all([
      desktopBridge.readPrivateAuditCollection<CanonicalCommitReceipt>("review-commits"),
      desktopBridge.readPrivateAuditCollection<CanonicalRestoreReceipt>("restore-receipts"),
    ]);
    nextCommits.sort((a, b) => b.committedAt.localeCompare(a.committedAt));
    setCommits(nextCommits); setRestores(nextRestores);
  }
  useEffect(() => { void reload().catch((error) => setMessage(`History 读取失败：${toMessage(error)}`)); }, []);
  const restoredIds = useMemo(() => new Set(restores.map((item) => item.commitReceiptId)), [restores]);

  async function restore(commit: CanonicalCommitReceipt): Promise<void> {
    if (!commit.snapshotId || restoredIds.has(commit.id)) return;
    if (!window.confirm(`确认恢复 ${commit.targetWorkCode} 到该 Commit 之前的状态？`)) return;
    setBusyId(commit.id);
    try {
      const count = await desktopBridge.restoreGovernanceSnapshot(commit.snapshotId);
      const restoredWorks = await desktopBridge.readLibraryCollection<Work>(privateRoot, "works");
      const restoredWork = restoredWorks.find((item) => item.id === commit.targetWorkId) ?? null;
      const receipt: CanonicalRestoreReceipt = {
        schemaVersion: 1,
        id: `restore_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        commitReceiptId: commit.id,
        snapshotId: commit.snapshotId,
        targetWorkId: commit.targetWorkId,
        targetWorkCode: commit.targetWorkCode,
        restoredAt: new Date().toISOString(),
        restoredEntryCount: count,
      };
      await desktopBridge.writePrivateAuditEntity("restore-receipts", receipt);
      const events = buildRestoredProvenanceEvents(commit, receipt.id, restoredWork);
      if (events.length) {
        const logs = await desktopBridge.readPrivateAuditCollection<WorkProvenanceLog>("provenance");
        const existing = logs.find((item) => item.workId === commit.targetWorkId);
        await desktopBridge.writePrivateAuditEntity("provenance", {
          schemaVersion: 1,
          id: commit.targetWorkId,
          workId: commit.targetWorkId,
          events: [...(existing?.events ?? []), ...events.map((event) => ({ schemaVersion: 1 as const, id: `prov_${crypto.randomUUID()}`, workId: commit.targetWorkId, ...event }))],
        } satisfies WorkProvenanceLog);
      }
      onLibraryChanged();
      await reload();
      setMessage(`已恢复 ${commit.targetWorkCode}；恢复 ${count} 个 Snapshot 条目。`);
    } catch (error) { setMessage(`恢复失败：${toMessage(error)}`); }
    finally { setBusyId(null); }
  }

  return <div className="page-stack governance-page"><GovernanceTitle eyebrow="HISTORY · SNAPSHOT · RESTORE" title={t("历史与恢复")} body={t("Commit 前保存最小 before-image Snapshot；恢复不会删除历史 Receipt，而是追加 Restore Receipt 与 Provenance。")} />
    <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">COMMIT RECEIPTS</span><h2>{t("Canonical 历史")}</h2></div><strong>{commits.length}</strong></div>
      <div className="history-list">{commits.map((commit) => <article key={commit.id}><div><b>{commit.targetWorkCode}</b><small>{new Date(commit.committedAt).toLocaleString()} · {commit.operationCount} operations</small><code>{commit.fingerprint.slice(0, 16)}…</code></div><div className="button-row"><button onClick={() => openWork(commit.targetWorkId)}>{t("打开 Work")}</button><button disabled={!commit.snapshotId || restoredIds.has(commit.id) || busyId === commit.id} onClick={() => void restore(commit)}>{restoredIds.has(commit.id) ? t("已恢复") : busyId === commit.id ? t("恢复中…") : t("恢复 Snapshot")}</button></div></article>)}</div>
    </section>
  </div>;
}

function toMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
