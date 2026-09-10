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
import { GovernanceEmpty, GovernanceMetric, GovernanceTitle } from "./desktop-page-primitives";
import { CommitPlanView, EntityDecisionList, FieldDecisionTable } from "./desktop-review-sections";
import { desktopVocabularyRepository } from "./desktop-vocabulary-repository";
import type { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { desktopBridge } from "./tauri-bridge";

interface DesktopReviewPageProps {
  repository: TauriLibraryRepository;
  openWork: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
  embedded?: boolean;
  reloadSignal?: number;
}

/**
 * Review 页是 Evidence 到 Canonical Library 的应用层协调器。
 *
 * 它可以组合已有的分析与 Commit Plan Service，但不能把匹配规则复制到 React 中。
 * 路由层只有在确认用户配置了 Private Library 后才会渲染本页；Review 本身不接收目录字符串，
 * 真正的写入目标由 Native Boundary 从当前设置再次解析，WebView 因而不能指定任意写入路径。
 */
export function DesktopReviewPage({
  repository,
  onLibraryChanged,
  setMessage,
  openWork,
  embedded = false,
  reloadSignal = 0,
}: DesktopReviewPageProps) {
  const { t } = useDesktopI18n();
  // Inbox 原始证据与生命周期分开保存，因为 Evidence 是不可变来源，忽略/提交状态属于独立审计记录。
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [lifecycles, setLifecycles] = useState<EvidenceLifecycleRecord[]>([]);
  // selectedId 是用户选择；analysis、decisions 和 built 则是由该选择逐步派生的审核会话状态。
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
    // 两个集合互不依赖，可以并行读取；排序只影响界面，不改写 Evidence 本体。
    const [nextRecords, nextLifecycles] = await Promise.all([
      desktopBridge.readPrivateAuditCollection<EvidenceRecord>("evidence"),
      desktopBridge.readPrivateAuditCollection<EvidenceLifecycleRecord>("evidence-lifecycle"),
    ]);
    nextRecords.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
    setRecords(nextRecords);
    setLifecycles(nextLifecycles);
  }

  useEffect(() => {
    // 页面首次进入时加载 Inbox。写操作完成后会显式调用 reloadInbox，无需依赖轮询。
    void reloadInbox().catch((error) => setMessage(`Evidence 读取失败：${message(error)}`));
  }, [reloadSignal]);

  useEffect(() => {
    // 切换 Evidence 后，旧 Plan 立即失效。disposed 防止较慢的旧分析覆盖用户后来选择的新记录。
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
      // 浏览器持有的 Plan 只是预览。Commit 前重算并比较 fingerprint，防止用旧计划覆盖期间发生的资料变化。
      const fresh = await buildCanonicalCommitPlan(selected, analysis!, decisions, repository, true);
      if (fresh.plan.fingerprint !== built.plan.fingerprint) {
        throw new Error("资料库或审核决策已变化，请重新生成 Commit Plan。 ");
      }
      // JSON 跨文件写入没有数据库事务，因此先保存 before-image Snapshot，失败时才能补偿恢复。
      snapshot = await desktopBridge.createGovernanceSnapshot<CanonicalSnapshot>(fresh.plan);
      const committedAt = new Date().toISOString();
      const receiptId = `commit_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

      // 先写被引用实体，最后写 Work，确保任何时刻都不会出现 Work 指向尚不存在实体的状态。
      for (const person of fresh.writes.people) await repository.savePerson(person);
      for (const organization of fresh.writes.organizations) await repository.saveOrganization(organization);
      for (const series of fresh.writes.series) await repository.saveSeries(series);
      for (const genre of fresh.writes.genres) await repository.saveGenre(genre);
      for (const tag of fresh.writes.tags) await repository.saveTag(tag);
      if (fresh.plan.operations.some((item) => item.kind === "create_work" || item.kind === "update_work")) {
        await repository.saveWork({ ...fresh.writes.work, updatedAt: committedAt });
      }

      // Canonical 写入完成后追加来源历史；Provenance 记录“为什么变成这样”，不能覆盖成单一当前来源。
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

      // 最后将 Evidence 标记为 committed 并保存 Receipt；Receipt 永久关联本次 Plan 与 Snapshot。
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
      // 只有成功创建 Snapshot 后才尝试回滚；Snapshot 之前的失败尚未触碰 Canonical 数据。
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
      {!embedded ? <GovernanceTitle eyebrow="IMPORT · REVIEW" title={t("资料核对")} body={t("核对来源资料与当前资料库的差异，明确选择后再应用；原始 Evidence 和变更历史会继续保留。") } /> : null}
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
                <GovernanceMetric label={t("已匹配")} value={analysis.summary.matchedEntities} />
                <GovernanceMetric label={t("新实体")} value={analysis.summary.newEntities} />
                <GovernanceMetric label={t("待决歧义")} value={analysis.summary.ambiguousEntities} />
                <GovernanceMetric label={t("字段冲突")} value={analysis.summary.conflictingFields} />
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




function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
