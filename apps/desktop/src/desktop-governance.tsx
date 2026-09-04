import { useEffect, useMemo, useState } from "react";

import { buildCurationOverview } from "@/application/curation/curation-service";
import { buildCanonicalCommitPlan, type BuiltCommitPlan } from "@/application/review/commit-plan-service";
import { analyzeSingleEvidenceRecord } from "@/application/review/entity-resolution-service";
import {
  createDefaultReviewDecisions,
  enumerateResolutions,
} from "@/application/review/review-decision-service";
import {
  buildAdoptedProvenanceEvents,
  buildRestoredProvenanceEvents,
} from "@/application/provenance/work-provenance-service";
import type {
  CanonicalCommitReceipt,
  EntityReviewAction,
  ReviewDecisions,
} from "@/domain/entities/commit-plan";
import type { EvidenceLifecycleRecord, EvidenceLifecycleStatus } from "@/domain/entities/evidence-lifecycle";
import type { EvidenceRecord } from "@/domain/entities/evidence";
import type { DuplicateCandidate } from "@/domain/entities/duplicate-candidate";
import type { WorkProvenanceLog } from "@/domain/entities/provenance";
import type { EvidenceReviewAnalysis, ReviewFieldComparison } from "@/domain/entities/review";
import type { CanonicalRestoreReceipt, CanonicalSnapshot } from "@/domain/entities/snapshot";
import type { Work } from "@/domain/entities/work";

import { useDesktopI18n } from "./desktop-i18n";
import { DesktopPresentationWorkbench } from "./desktop-presentation-workbench";
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
    return <CurationWorkbench repository={repository} openWork={openWork} openPerson={openPerson} onLibraryChanged={onLibraryChanged} setMessage={setMessage} />;
  }
  if (section === "history") {
    return <HistoryWorkbench privateRoot={privateRoot} onLibraryChanged={onLibraryChanged} setMessage={setMessage} openWork={openWork} />;
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

function FieldDecisionTable({ comparisons, decisions, onChange }: { comparisons: ReviewFieldComparison[]; decisions: ReviewDecisions; onChange: (next: ReviewDecisions) => void }) {
  const { t } = useDesktopI18n();
  const actionable = comparisons.filter((item) => item.status !== "same");
  if (!actionable.length) return null;
  return <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">FIELD DECISIONS</span><h2>{t("字段决策")}</h2></div></div><div className="governance-field-table">
    {actionable.map((item) => <div className="governance-field-row" key={item.field}>
      <strong>{item.field}</strong><span>{renderValue(item.libraryValue)}</span><span>{renderValue(item.evidenceValue)}</span>
      <select value={decisions.fields[item.field] ?? ""} onChange={(event) => onChange({ ...decisions, fields: { ...decisions.fields, [item.field]: event.target.value as "keep_library" | "use_evidence" } })}>
        <option value="">{t("请选择")}</option><option value="keep_library">{t("保留 Library")}</option><option value="use_evidence">{t("采用 Evidence")}</option>
      </select>
    </div>)}
  </div></section>;
}

function EntityDecisionList({ analysis, decisions, onChange }: { analysis: EvidenceReviewAnalysis; decisions: ReviewDecisions; onChange: (next: ReviewDecisions) => void }) {
  const { t } = useDesktopI18n();
  const items = enumerateResolutions(analysis);
  if (!items.length) return null;
  const byKey = new Map(decisions.entities.map((item) => [item.key, item]));
  return <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">ENTITY RESOLUTION</span><h2>{t("实体决策")}</h2></div></div><div className="governance-resolution-list">
    {items.map((item) => {
      const decision = byKey.get(item.key);
      return <div className="governance-resolution-row" key={item.key}>
        <span><b>{item.kind}</b><small>{item.resolution.sourceValue}</small></span>
        <span className={`governance-status is-${item.resolution.status}`}>{item.resolution.status}</span>
        <select value={encodeEntityDecision(decision)} onChange={(event) => {
          const next = decodeEntityDecision(item.key, event.target.value);
          onChange({ ...decisions, entities: [...decisions.entities.filter((value) => value.key !== item.key), ...(next ? [next] : [])] });
        }}>
          <option value="">{t("请选择")}</option>
          {item.resolution.matchedId ? <option value={`use_match:${item.resolution.matchedId}`}>{t("使用匹配")}：{item.resolution.matchedLabel ?? item.resolution.matchedId}</option> : null}
          {item.resolution.candidates.map((candidate) => <option key={candidate.id} value={`bind_existing:${candidate.id}`}>{t("绑定")}：{candidate.label}</option>)}
          {item.kind !== "work_type" ? <option value="create_new">{t("创建新实体")}</option> : null}
          <option value="skip">{t("跳过")}</option>
        </select>
      </div>;
    })}
  </div></section>;
}

function CommitPlanView({ built, onCommit, busy }: { built: BuiltCommitPlan; onCommit: () => void; busy: boolean }) {
  const { t } = useDesktopI18n();
  return <div className="governance-plan"><div className="governance-plan-head"><strong>{built.plan.mode === "create" ? t("创建") : t("更新")} {built.plan.targetWorkCode}</strong><code>{built.plan.fingerprint.slice(0, 16)}…</code></div>
    {built.plan.blockers.length ? <ul className="governance-blockers">{built.plan.blockers.map((item) => <li key={item}>{item}</li>)}</ul> : null}
    {built.plan.warnings.length ? <ul>{built.plan.warnings.map((item) => <li key={item}>{item}</li>)}</ul> : null}
    <ol>{built.plan.operations.map((item, index) => <li key={`${item.kind}:${item.entityId}:${index}`}><b>{item.kind}</b> · {item.label}<small>{item.detail}</small></li>)}</ol>
    <button className="primary-button" disabled={busy || built.plan.blockers.length > 0} onClick={onCommit}>{t("确认执行 Commit")}</button>
  </div>;
}

function CurationWorkbench({
  repository,
  openWork,
  openPerson,
  onLibraryChanged,
  setMessage,
}: {
  repository: TauriLibraryRepository;
  openWork: (id: string) => void;
  openPerson: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (value: string) => void;
}) {
  const { t } = useDesktopI18n();
  const [mode, setMode] = useState<"overview" | "presentation">("overview");
  const [data, setData] = useState<Awaited<ReturnType<typeof buildCurationOverview>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== "overview") return;
    void buildCurationOverview(repository)
      .then((value) => { setData(value); setError(null); })
      .catch((value) => setError(message(value)));
  }, [repository, mode]);

  return <div className="page-stack governance-page">
    <GovernanceTitle eyebrow="CURATION · COMPLETENESS · PRESENTATION" title={t("资料治理")} body={t("完整度、重复候选与私人展示偏好都在这里治理；Presentation 只影响当前 Private Library 的显示选择。")}/>
    <div className="desktop-segmented-control governance-subnav" role="tablist" aria-label={t("治理视图")}>
      <button className={mode === "overview" ? "is-active" : undefined} onClick={() => setMode("overview")} type="button">{t("完整度 / 重复")}</button>
      <button className={mode === "presentation" ? "is-active" : undefined} onClick={() => setMode("presentation")} type="button">{t("展示偏好")}</button>
    </div>
    {mode === "presentation" ? (
      <DesktopPresentationWorkbench repository={repository} openWork={openWork} openPerson={openPerson} onLibraryChanged={onLibraryChanged} setMessage={setMessage} />
    ) : error ? (
      <GovernanceEmpty title={t("Curation 读取失败")} body={error} />
    ) : !data ? (
      <GovernanceEmpty title={t("正在计算资料完整度")} body={t("正在分析 Work / Person 完整度与重复候选…")} />
    ) : (
      <>
        <div className="governance-metrics governance-metrics--wide">
          <Metric label={t("Work 待完善")} value={data.stats.worksNeedingAttention} /><Metric label={t("Person 待完善")} value={data.stats.peopleNeedingAttention} /><Metric label={t("Work 重复候选")} value={data.stats.duplicateWorks} /><Metric label={t("Person 重复候选")} value={data.stats.duplicatePeople} />
        </div>
        <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">LOW COMPLETENESS</span><h2>{t("优先完善的作品")}</h2></div></div><div className="curation-list">{data.works.slice(0, 80).map(({ work, completeness }) => <button key={work.id} onClick={() => openWork(work.id)}><span><b>{work.code}</b><small>{Object.values(work.titles)[0] ?? work.id}</small></span><strong>{completeness.score}%</strong><small>{completeness.missingIds.join(" · ") || "complete"}</small></button>)}</div></section>
        <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">PEOPLE</span><h2>{t("优先完善的人物")}</h2></div></div><div className="curation-list">{data.people.slice(0, 80).map(({ person, completeness }) => <button key={person.id} onClick={() => openPerson(person.id)}><span><b>{person.names[0]?.value ?? person.id}</b></span><strong>{completeness.score}%</strong><small>{completeness.missingIds.join(" · ") || "complete"}</small></button>)}</div></section>
        <DuplicateList title={t("Work 重复候选")} items={data.duplicateWorks} />
        <DuplicateList title={t("Person 重复候选")} items={data.duplicatePeople} />
      </>
    )}
  </div>;
}

function HistoryWorkbench({ privateRoot, onLibraryChanged, setMessage, openWork }: { privateRoot: string; onLibraryChanged: () => void; setMessage: (value: string) => void; openWork: (id: string) => void }) {
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
  useEffect(() => { void reload().catch((error) => setMessage(`History 读取失败：${message(error)}`)); }, []);
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
    } catch (error) { setMessage(`恢复失败：${message(error)}`); }
    finally { setBusyId(null); }
  }

  return <div className="page-stack governance-page"><GovernanceTitle eyebrow="HISTORY · SNAPSHOT · RESTORE" title={t("历史与恢复")} body={t("Commit 前保存最小 before-image Snapshot；恢复不会删除历史 Receipt，而是追加 Restore Receipt 与 Provenance。")} />
    <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">COMMIT RECEIPTS</span><h2>{t("Canonical 历史")}</h2></div><strong>{commits.length}</strong></div>
      <div className="history-list">{commits.map((commit) => <article key={commit.id}><div><b>{commit.targetWorkCode}</b><small>{new Date(commit.committedAt).toLocaleString()} · {commit.operationCount} operations</small><code>{commit.fingerprint.slice(0, 16)}…</code></div><div className="button-row"><button onClick={() => openWork(commit.targetWorkId)}>{t("打开 Work")}</button><button disabled={!commit.snapshotId || restoredIds.has(commit.id) || busyId === commit.id} onClick={() => void restore(commit)}>{restoredIds.has(commit.id) ? t("已恢复") : busyId === commit.id ? t("恢复中…") : t("恢复 Snapshot")}</button></div></article>)}</div>
    </section>
  </div>;
}

function GovernanceTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <header className="governance-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{body}</p></header>;
}
function GovernanceEmpty({ title, body }: { title: string; body: string }) { return <section className="settings-card governance-empty"><h2>{title}</h2><p className="muted">{body}</p></section>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="governance-metric"><span>{label}</span><strong>{value}</strong></div>; }
function DuplicateList({ title, items }: { title: string; items: DuplicateCandidate[] }) { const { t } = useDesktopI18n(); return <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">DUPLICATES</span><h2>{title}</h2></div><strong>{items.length}</strong></div>{items.length ? <div className="duplicate-list">{items.slice(0, 80).map((item) => <div key={item.id}><code>{item.leftId}</code><span>↔</span><code>{item.rightId}</code><b>{item.confidence}</b><small>{item.reasonIds.join(" · ")}</small></div>)}</div> : <p className="muted">{t("没有发现重复候选。")}</p>}</section>; }

function renderValue(value: unknown): string { if (value === null || value === undefined) return "—"; if (Array.isArray(value)) return value.length ? value.join(" / ") : "—"; return String(value); }
function encodeEntityDecision(decision: ReviewDecisions["entities"][number] | undefined): string { if (!decision) return ""; return decision.targetId ? `${decision.action}:${decision.targetId}` : decision.action; }
function decodeEntityDecision(key: string, encoded: string): ReviewDecisions["entities"][number] | null {
  if (!encoded) return null;
  const [actionRaw, targetId] = encoded.split(":", 2);
  const action = actionRaw as EntityReviewAction;
  return { key, action, ...(targetId ? { targetId } : {}) };
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
