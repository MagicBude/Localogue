import { useEffect, useMemo, useState } from "react";

import { buildCanonicalCommitPlan, type BuiltCommitPlan } from "@/application/review/commit-plan-service";
import { analyzeSingleEvidenceRecord } from "@/application/review/entity-resolution-service";
import { createDefaultReviewDecisions } from "@/application/review/review-decision-service";
import {
  buildAdoptedProvenanceEvents,
} from "@/application/provenance/work-provenance-service";
import type { CanonicalCommitReceipt, ReviewDecisions } from "@/domain/entities/commit-plan";
import type { EvidenceLifecycleRecord, EvidenceLifecycleStatus } from "@/domain/entities/evidence-lifecycle";
import type { EvidenceRecord } from "@/domain/entities/evidence";
import type { WorkProvenanceLog } from "@/domain/entities/provenance";
import type { EvidenceReviewAnalysis } from "@/domain/entities/review";
import type { CanonicalSnapshot } from "@/domain/entities/snapshot";

import { useDesktopI18n } from "./desktop-i18n";
import { DesktopCurationPage } from "./desktop-curation-page";
import { DesktopHistoryPage } from "./desktop-history-page";
import { CommitPlanView, EntityDecisionList, FieldDecisionTable } from "./desktop-review-sections";
import { desktopVocabularyRepository } from "./desktop-vocabulary-repository";
import type { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { desktopBridge } from "./tauri-bridge";

export type GovernanceSection = "review" | "curation" | "history";

interface GovernanceProps {
  repository: TauriLibraryRepository;
  privateRoot: string | null;
  section: GovernanceSection;
  openWork: (id: string) => void;
  openPerson: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
}

export function DesktopGovernance({
  repository,
  privateRoot,
  section,
  openWork,
  openPerson,
  onLibraryChanged,
  setMessage,
}: GovernanceProps) {
  if (!privateRoot) {
    return <GovernanceEmpty title="治理工作台" body="Governance 只允许写入 Private Library。请先在设置中配置私人资料库。" />;
  }
  if (section === "curation") {
    return <DesktopCurationPage repository={repository} openWork={openWork} openPerson={openPerson} onLibraryChanged={onLibraryChanged} setMessage={setMessage} />;
  }
  if (section === "history") {
    return <DesktopHistoryPage privateRoot={privateRoot} onLibraryChanged={onLibraryChanged} setMessage={setMessage} openWork={openWork} />;
  }
  return <ReviewWorkbench repository={repository} privateRoot={privateRoot} onLibraryChanged={onLibraryChanged} setMessage={setMessage} openWork={openWork} />;
}

function ReviewWorkbench({
  repository,
  privateRoot,
  onLibraryChanged,
  setMessage,
  openWork,
}: Omit<GovernanceProps, "section" | "openPerson">) {
  const { t } = useDesktopI18n();
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [lifecycles, setLifecycles] = useState<EvidenceLifecycleRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<EvidenceReviewAnalysis | null>(null);
  const [decisions, setDecisions] = useState<ReviewDecisions>({ fields: {}, entities: [] });
  const [built, setBuilt] = useState<BuiltCommitPlan | null>(null);
  const [busy, setBusy] = useState(false);

  const lifecycleByEvidence = useMemo(
    () => new Map(lifecycles.map((item) => [item.evidenceId, item])),
    [lifecycles],
  );
  const selected = records.find((item) => item.id === selectedId) ?? null;

  async function reloadInbox(): Promise<void> {
    const [nextRecords, nextLifecycles] = await Promise.all([
      desktopBridge.readPrivateAuditCollection<EvidenceRecord>("evidence"),
      desktopBridge.readPrivateAuditCollection<EvidenceLifecycleRecord>("evidence-lifecycle"),
    ]);
    nextRecords.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
    setRecords(nextRecords);
    setLifecycles(nextLifecycles);
  }

  useEffect(() => {
    void reloadInbox().catch((error) => setMessage(`Evidence 读取失败：${message(error)}`));
  }, []);

  useEffect(() => {
    let disposed = false;
    setBuilt(null);
    setAnalysis(null);
    if (!selected) return;
    void analyzeSingleEvidenceRecord(selected, repository, desktopVocabularyRepository)
      .then((value) => {
        if (disposed) return;
        setAnalysis(value);
        setDecisions(createDefaultReviewDecisions(value));
      })
      .catch((error) => !disposed && setMessage(`Review 分析失败：${message(error)}`));
    return () => { disposed = true; };
  }, [selected?.id, repository]);

  async function setLifecycle(status: EvidenceLifecycleStatus): Promise<void> {
    if (!selected) return;
    const record: EvidenceLifecycleRecord = {
      schemaVersion: 1,
      id: selected.id,
      evidenceId: selected.id,
      status,
      updatedAt: new Date().toISOString(),
    };
    await desktopBridge.writePrivateAuditEntity("evidence-lifecycle", record);
    await reloadInbox();
  }

  async function generatePlan(): Promise<void> {
    if (!selected || !analysis) return;
    setBusy(true);
    try {
      const next = await buildCanonicalCommitPlan(selected, analysis, decisions, repository, true);
      setBuilt(next);
      if (next.plan.blockers.length) {
        setMessage(`Commit Plan 仍有 ${next.plan.blockers.length} 个阻塞项。`);
      } else {
        setMessage(`Commit Plan 已生成：${next.plan.operations.length} 个操作。`);
      }
    } catch (error) {
      setMessage(`生成 Commit Plan 失败：${message(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function commitPlan(): Promise<void> {
    if (!selected || !built || built.plan.blockers.length) return;
    if (!window.confirm(`确认执行 ${built.plan.targetWorkCode} 的 ${built.plan.operations.length} 个 Canonical 操作？`)) return;
    setBusy(true);
    let snapshot: CanonicalSnapshot | null = null;
    try {
      // Commit 前重新计算；fingerprint 不一致意味着资料库或决策已经发生变化。
      const fresh = await buildCanonicalCommitPlan(selected, analysis!, decisions, repository, true);
      if (fresh.plan.fingerprint !== built.plan.fingerprint) {
        throw new Error("资料库或审核决策已变化，请重新生成 Commit Plan。 ");
      }
      snapshot = await desktopBridge.createGovernanceSnapshot<CanonicalSnapshot>(fresh.plan);
      const committedAt = new Date().toISOString();
      const receiptId = `commit_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

      for (const person of fresh.writes.people) await repository.savePerson(person);
      for (const organization of fresh.writes.organizations) await repository.saveOrganization(organization);
      for (const series of fresh.writes.series) await repository.saveSeries(series);
      for (const genre of fresh.writes.genres) await repository.saveGenre(genre);
      for (const tag of fresh.writes.tags) await repository.saveTag(tag);
      if (fresh.plan.operations.some((item) => item.kind === "create_work" || item.kind === "update_work")) {
        await repository.saveWork({ ...fresh.writes.work, updatedAt: committedAt });
      }

      const provenanceEvents = buildAdoptedProvenanceEvents(selected, fresh.plan, receiptId);
      if (provenanceEvents.length) {
        const logs = await desktopBridge.readPrivateAuditCollection<WorkProvenanceLog>("provenance");
        const existing = logs.find((item) => item.workId === fresh.plan.targetWorkId);
        const created = provenanceEvents.map((event) => ({
          schemaVersion: 1 as const,
          id: `prov_${crypto.randomUUID()}`,
          workId: fresh.plan.targetWorkId,
          ...event,
        }));
        const log: WorkProvenanceLog = {
          schemaVersion: 1,
          id: fresh.plan.targetWorkId,
          workId: fresh.plan.targetWorkId,
          events: [...(existing?.events ?? []), ...created],
        };
        await desktopBridge.writePrivateAuditEntity("provenance", log);
      }

      const lifecycle: EvidenceLifecycleRecord = {
        schemaVersion: 1,
        id: selected.id,
        evidenceId: selected.id,
        status: "committed",
        updatedAt: committedAt,
        commitReceiptId: receiptId,
      };
      await desktopBridge.writePrivateAuditEntity("evidence-lifecycle", lifecycle);
      const receipt: CanonicalCommitReceipt = {
        schemaVersion: 2,
        id: receiptId,
        evidenceId: selected.id,
        committedAt,
        fingerprint: fresh.plan.fingerprint,
        targetWorkId: fresh.plan.targetWorkId,
        targetWorkCode: fresh.plan.targetWorkCode,
        operationCount: fresh.plan.operations.length,
        operations: fresh.plan.operations,
        snapshotId: snapshot.id,
      };
      await desktopBridge.writePrivateAuditEntity("review-commits", receipt);
      setBuilt(null);
      onLibraryChanged();
      await reloadInbox();
      setMessage(`已提交 ${fresh.plan.targetWorkCode}；Snapshot ${snapshot.id} 已保留。`);
    } catch (error) {
      if (snapshot) {
        try {
          await desktopBridge.restoreGovernanceSnapshot(snapshot.id);
          onLibraryChanged();
          setMessage(`Commit 失败，已自动恢复 Snapshot。原因：${message(error)}`);
        } catch (rollbackError) {
          setMessage(`Commit 失败且自动恢复失败。原始错误：${message(error)}；恢复错误：${message(rollbackError)}`);
        }
      } else {
        setMessage(`Commit 失败：${message(error)}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack governance-page">
      <GovernanceTitle eyebrow="EVIDENCE · REVIEW · COMMIT PLAN" title={t("审核工作台")} body={t("Evidence 保持不可变；先分析差异、明确决策、生成 Commit Plan，再显式提交到 Private Canonical Library。 ")} />
      <div className="governance-split">
        <section className="settings-card governance-inbox">
          <div className="section-heading"><div><span className="eyebrow">EVIDENCE INBOX</span><h2>{t("待审核证据")}</h2></div><strong>{records.length}</strong></div>
          {!records.length ? <p className="muted">{t("当前 Private Library 还没有 Evidence。Web Import 或 Desktop Evidence Import 产生的证据会出现在这里。")}</p> : null}
          <div className="governance-inbox-list">
            {records.map((record) => {
              const lifecycle = lifecycleByEvidence.get(record.id)?.status ?? "pending";
              return <button key={record.id} className={selectedId === record.id ? "governance-inbox-item is-active" : "governance-inbox-item"} onClick={() => setSelectedId(record.id)}>
                <span><b>{record.normalized.code ?? "—"}</b><small>{record.normalized.title ?? record.normalized.originalTitle ?? record.sourceName}</small></span>
                <em className={`governance-status is-${lifecycle}`}>{lifecycle}</em>
              </button>;
            })}
          </div>
        </section>

        <section className="governance-review-pane">
          {!selected ? <GovernanceEmpty title={t("选择一条 Evidence")} body={t("从左侧 Inbox 选择来源证据后，Desktop 会只读分析当前 Canonical Library。") } /> : null}
          {selected && !analysis ? <GovernanceEmpty title={t("正在分析")} body={t("正在解析 Work 与关联实体差异…")} /> : null}
          {selected && analysis ? <>
            <section className="settings-card governance-analysis-card">
              <div className="section-heading"><div><span className="eyebrow">REVIEW ANALYSIS</span><h2>{analysis.code ?? selected.sourceName}</h2><p className="muted">{analysis.title ?? selected.sourceName}</p></div><span className={`governance-status is-${analysis.workStatus}`}>{analysis.workStatus}</span></div>
              <div className="governance-metrics">
                <Metric label={t("已匹配")} value={analysis.summary.matchedEntities} />
                <Metric label={t("新实体")} value={analysis.summary.newEntities} />
                <Metric label={t("待决歧义")} value={analysis.summary.ambiguousEntities} />
                <Metric label={t("字段冲突")} value={analysis.summary.conflictingFields} />
              </div>
              {analysis.matchedWorkId ? <button onClick={() => openWork(analysis.matchedWorkId!)}>{t("打开当前 Canonical Work")}</button> : null}
            </section>

            <FieldDecisionTable comparisons={analysis.comparisons} decisions={decisions} onChange={setDecisions} />
            <EntityDecisionList analysis={analysis} decisions={decisions} onChange={setDecisions} />

            <section className="settings-card governance-actions-card">
              <div className="button-row">
                <button disabled={busy} onClick={() => void setLifecycle("ignored")}>{t("忽略 Evidence")}</button>
                <button className="primary-button" disabled={busy} onClick={() => void generatePlan()}>{t("生成 Commit Plan")}</button>
              </div>
              {built ? <CommitPlanView built={built} onCommit={() => void commitPlan()} busy={busy} /> : null}
            </section>
          </> : null}
        </section>
      </div>
    </div>
  );
}




function GovernanceTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <header className="governance-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{body}</p></header>;
}
function GovernanceEmpty({ title, body }: { title: string; body: string }) { return <section className="settings-card governance-empty"><h2>{title}</h2><p className="muted">{body}</p></section>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="governance-metric"><span>{label}</span><strong>{value}</strong></div>; }

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
