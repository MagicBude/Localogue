import { useEffect, useMemo, useState } from "react";

import { enumerateResolutions } from "@/application/review/review-decision-service";
import type { BuiltCommitPlan } from "@/application/review/commit-plan-service";
import type { CanonicalCommitReceipt, ReviewDecisions } from "@/domain/entities/commit-plan";
import type { EvidenceLifecycleStatus } from "@/domain/entities/evidence-lifecycle";
import type { EvidenceRecord } from "@/domain/entities/evidence";
import type { EvidenceReviewAnalysis } from "@/domain/entities/review";
import { getPreferredPersonName, localizeText } from "@/application/services/localization-service";

import { useDesktopI18n } from "./desktop-i18n";
import { useStableAsyncData } from "./use-stable-async-data";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { desktopBridge } from "./tauri-bridge";
import {
  buildCurationOverview,
  executeDesktopCanonicalCommit,
  loadDesktopGovernanceInbox,
  loadDesktopHistory,
  prepareDesktopReview,
  rebuildDesktopCommitPlan,
  restoreDesktopCommit,
  setDesktopEvidenceLifecycle,
  type DesktopEvidenceRow,
} from "./desktop-governance-service";

interface DesktopGovernanceProps {
  repository: TauriLibraryRepository;
  privateLibraryPath: string | null;
  openWork: (id: string) => void;
  openPerson: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
  onOpenPortablePacks: () => void;
  webUrl: string;
}

type GovernanceTab = "evidence" | "curation" | "history" | "portable";

const dictionaries = {
  "zh-CN": {
    title: "治理工作台", description: "Evidence → Review → Commit、完整度、重复候选、History / Restore 与便携包入口。所有写入只落 Private Library。",
    evidence: "Evidence 审核", curation: "资料治理", history: "历史 / 恢复", portable: "便携包",
    pending: "待审核", committed: "已提交", ignored: "已忽略", all: "全部", emptyEvidence: "当前没有 Evidence。Web 导入工作台或后续 Desktop Evidence Import 会把证据写入这里。",
    source: "来源", imported: "导入时间", status: "状态", open: "审核", ignore: "忽略", restorePending: "恢复待审核", matched: "已匹配", newEntities: "新实体", ambiguous: "歧义", conflicts: "冲突字段",
    back: "返回 Inbox", review: "Evidence Review", fieldDecisions: "字段决策", entityDecisions: "实体决策", plan: "Commit Plan", keepLibrary: "保留资料库", useEvidence: "采用 Evidence",
    useMatch: "使用唯一匹配", createNew: "创建新实体", skip: "跳过", bindExisting: "绑定已有实体", blockers: "阻塞项", warnings: "警告", operations: "操作", rebuild: "重新生成 Plan", commit: "确认提交", committing: "提交中…",
    commitDone: "Canonical Commit 完成", curationDesc: "按完整度优先处理缺失资料，并列出可解释的重复候选；不会自动合并。", worksAttention: "待补作品", peopleAttention: "待补人物", duplicateWorks: "重复作品候选", duplicatePeople: "重复人物候选",
    score: "完整度", missing: "缺失", duplicates: "重复候选", noDuplicates: "当前没有重复候选。", historyDesc: "只允许恢复某作品最新的活动 Commit；恢复前会检查 Snapshot 与引用关系。", noHistory: "当前没有 Commit 历史。", restore: "恢复", restored: "已恢复", snapshot: "Snapshot", operationsCount: "操作数", confirmRestore: "输入番号确认恢复", restoreDone: "Snapshot Restore 完成",
    portableDesc: "Shared Pack 的挂载/优先级继续在资料包页管理；Portable Pack 二进制导入导出仍使用 Web 工作台，避免在 V1-23 重新实现第二套归档协议。", openPortable: "打开资料包管理", openPortableWeb: "打开 Web Portable Pack 工作台", privateRequired: "Governance 写操作需要 Private Library。",
    loading: "正在读取治理数据…", failed: "治理数据读取失败", refreshing: "正在刷新…", evidenceStatus: "作品判断", noFieldChanges: "没有字段差异。", noEntityChanges: "没有需要决策的关系实体。", target: "目标", fingerprint: "计划指纹", modeCreate: "创建 Work", modeUpdate: "更新 Work",
  },
  ja: {
    title: "ガバナンスワークベンチ", description: "Evidence → Review → Commit、完全性、重複候補、History / Restore、Portable Pack への入口です。書き込みは Private Library のみに行います。",
    evidence: "Evidence レビュー", curation: "キュレーション", history: "履歴 / 復元", portable: "Portable Pack",
    pending: "レビュー待ち", committed: "コミット済み", ignored: "無視", all: "すべて", emptyEvidence: "Evidence はありません。Web Import または今後の Desktop Evidence Import から保存されます。",
    source: "ソース", imported: "取込日時", status: "状態", open: "レビュー", ignore: "無視", restorePending: "レビュー待ちへ戻す", matched: "一致", newEntities: "新規", ambiguous: "曖昧", conflicts: "競合フィールド",
    back: "Inbox に戻る", review: "Evidence Review", fieldDecisions: "フィールド決定", entityDecisions: "エンティティ決定", plan: "Commit Plan", keepLibrary: "Library を保持", useEvidence: "Evidence を採用",
    useMatch: "一意の一致を使用", createNew: "新規作成", skip: "スキップ", bindExisting: "既存へ関連", blockers: "ブロッカー", warnings: "警告", operations: "操作", rebuild: "Plan を再生成", commit: "コミット確認", committing: "コミット中…",
    commitDone: "Canonical Commit が完了しました", curationDesc: "完全性の低い資料と説明可能な重複候補を優先表示します。自動マージはしません。", worksAttention: "要補完 Work", peopleAttention: "要補完 Person", duplicateWorks: "重複 Work 候補", duplicatePeople: "重複 Person 候補",
    score: "完全性", missing: "不足", duplicates: "重複候補", noDuplicates: "重複候補はありません。", historyDesc: "各 Work の最新アクティブ Commit のみ復元できます。Snapshot と参照関係を事前確認します。", noHistory: "Commit 履歴はありません。", restore: "復元", restored: "復元済み", snapshot: "Snapshot", operationsCount: "操作数", confirmRestore: "番号を入力して復元を確認", restoreDone: "Snapshot Restore が完了しました",
    portableDesc: "Shared Pack のマウントと優先順位は Pack 画面で管理します。Portable Pack のバイナリ入出力は V1-23 では Web ワークベンチを再利用し、別実装を増やしません。", openPortable: "Pack 管理を開く", openPortableWeb: "Web Portable Pack を開く", privateRequired: "Governance の書き込みには Private Library が必要です。",
    loading: "ガバナンスデータを読み込み中…", failed: "ガバナンスデータを読み込めません", refreshing: "更新中…", evidenceStatus: "Work 判定", noFieldChanges: "フィールド差分はありません。", noEntityChanges: "決定が必要な関連エンティティはありません。", target: "対象", fingerprint: "Plan fingerprint", modeCreate: "Work を作成", modeUpdate: "Work を更新",
  },
  en: {
    title: "Governance Workbench", description: "Evidence → Review → Commit, completeness, duplicate candidates, History / Restore, and Portable Pack entry points. Writes stay in the Private Library.",
    evidence: "Evidence Review", curation: "Curation", history: "History / Restore", portable: "Portable Packs",
    pending: "Pending", committed: "Committed", ignored: "Ignored", all: "All", emptyEvidence: "There is no Evidence yet. Web Import or a future Desktop Evidence Import will save evidence here.",
    source: "Source", imported: "Imported", status: "Status", open: "Review", ignore: "Ignore", restorePending: "Restore pending", matched: "Matched", newEntities: "New", ambiguous: "Ambiguous", conflicts: "Conflicts",
    back: "Back to Inbox", review: "Evidence Review", fieldDecisions: "Field decisions", entityDecisions: "Entity decisions", plan: "Commit Plan", keepLibrary: "Keep library", useEvidence: "Use Evidence",
    useMatch: "Use unique match", createNew: "Create new", skip: "Skip", bindExisting: "Bind existing", blockers: "Blockers", warnings: "Warnings", operations: "Operations", rebuild: "Rebuild Plan", commit: "Confirm commit", committing: "Committing…",
    commitDone: "Canonical Commit completed", curationDesc: "Prioritize incomplete metadata and show explainable duplicate candidates. Nothing is merged automatically.", worksAttention: "Works needing attention", peopleAttention: "People needing attention", duplicateWorks: "Duplicate Work candidates", duplicatePeople: "Duplicate Person candidates",
    score: "Completeness", missing: "Missing", duplicates: "Duplicates", noDuplicates: "No duplicate candidates.", historyDesc: "Only the latest active Commit for a Work can be restored. Snapshot and reference safety are checked first.", noHistory: "No Commit history yet.", restore: "Restore", restored: "Restored", snapshot: "Snapshot", operationsCount: "Operations", confirmRestore: "Type the code to confirm restore", restoreDone: "Snapshot Restore completed",
    portableDesc: "Shared Pack mounting and priority stay on the Packs page. V1-23 reuses the Web workbench for Portable Pack binary import/export rather than introducing a second archive implementation.", openPortable: "Open Pack management", openPortableWeb: "Open Web Portable Pack workbench", privateRequired: "Governance writes require a Private Library.",
    loading: "Loading governance data…", failed: "Failed to load governance data", refreshing: "Refreshing…", evidenceStatus: "Work status", noFieldChanges: "No field differences.", noEntityChanges: "No related entities need decisions.", target: "Target", fingerprint: "Plan fingerprint", modeCreate: "Create Work", modeUpdate: "Update Work",
  },
} as const;

export function DesktopGovernance({ repository, privateLibraryPath, openWork, openPerson, onLibraryChanged, setMessage, onOpenPortablePacks, webUrl }: DesktopGovernanceProps) {
  const { uiLanguage } = useDesktopI18n();
  const text = dictionaries[uiLanguage];
  const [tab, setTab] = useState<GovernanceTab>("evidence");
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);
  const [epoch, setEpoch] = useState(0);

  return <div className="governance-page page-stack">
    <section className="page-title-row">
      <div><span className="eyebrow">EVIDENCE · CURATION · HISTORY</span><h1>{text.title}</h1><p className="muted">{text.description}</p></div>
    </section>
    {!privateLibraryPath ? <div className="status-line warning-text">{text.privateRequired}</div> : null}
    <nav className="governance-tabs">
      {(["evidence", "curation", "history", "portable"] as const).map((id) => <button className={tab === id ? "active" : ""} key={id} onClick={() => { setTab(id); setSelectedEvidence(null); }} type="button">{text[id]}</button>)}
    </nav>
    {tab === "evidence" ? !privateLibraryPath ? <div className="empty-state"><p>{text.privateRequired}</p></div> : selectedEvidence ? <DesktopEvidenceReview evidence={selectedEvidence} repository={repository} privateLibraryPath={privateLibraryPath} onBack={() => setSelectedEvidence(null)} onCommitted={() => { setEpoch((value) => value + 1); onLibraryChanged(); setSelectedEvidence(null); }} setMessage={setMessage} /> : <DesktopEvidenceInbox repository={repository} epoch={epoch} onOpen={setSelectedEvidence} onChanged={() => setEpoch((value) => value + 1)} /> : null}
    {tab === "curation" ? <DesktopCuration repository={repository} openWork={openWork} openPerson={openPerson} /> : null}
    {tab === "history" ? !privateLibraryPath ? <div className="empty-state"><p>{text.privateRequired}</p></div> : <DesktopHistory repository={repository} epoch={epoch} onRestored={() => { setEpoch((value) => value + 1); onLibraryChanged(); }} setMessage={setMessage} /> : null}
    {tab === "portable" ? <section className="settings-card"><span className="eyebrow">PORTABLE · TRANSPORT</span><h2>{text.portable}</h2><p className="muted">{text.portableDesc}</p><div className="button-row"><button className="primary-button" onClick={onOpenPortablePacks} type="button">{text.openPortable}</button><button onClick={() => void desktopBridge.openWebUrl(`${webUrl.replace(/\/$/, "")}/packs`)} type="button">{text.openPortableWeb}</button></div></section> : null}
  </div>;
}

function DesktopEvidenceInbox({ repository, epoch, onOpen, onChanged }: { repository: TauriLibraryRepository; epoch: number; onOpen: (evidence: EvidenceRecord) => void; onChanged: () => void }) {
  const { uiLanguage } = useDesktopI18n(); const text = dictionaries[uiLanguage];
  const [filter, setFilter] = useState<EvidenceLifecycleStatus | "all">("pending");
  const data = useStableAsyncData(() => loadDesktopGovernanceInbox(repository), [repository, epoch]);
  if (data.loading && !data.value) return <p className="muted">{text.loading}</p>;
  if (data.error && !data.value) return <p className="error-text">{text.failed}: {String(data.error)}</p>;
  const inbox = data.value;
  if (!inbox) return null;
  const rows = filter === "all" ? inbox.rows : inbox.rows.filter((row) => row.lifecycle.status === filter);
  return <section className="governance-section">
    <div className="governance-filter-row">{(["pending", "committed", "ignored", "all"] as const).map((status) => <button className={filter === status ? "chip chip--strong" : "chip"} key={status} onClick={() => setFilter(status)} type="button">{text[status]} <strong>{inbox.counts[status]}</strong></button>)}{data.refreshing ? <span className="muted">{text.refreshing}</span> : null}</div>
    {!rows.length ? <div className="empty-state"><p>{text.emptyEvidence}</p></div> : <div className="governance-list">{rows.map((row) => <EvidenceRowCard key={row.evidence.id} row={row} onOpen={() => onOpen(row.evidence)} onChanged={onChanged} />)}</div>}
  </section>;
}

function EvidenceRowCard({ row, onOpen, onChanged }: { row: DesktopEvidenceRow; onOpen: () => void; onChanged: () => void }) {
  const { uiLanguage } = useDesktopI18n(); const text = dictionaries[uiLanguage]; const [busy, setBusy] = useState(false);
  const change = async (status: "pending" | "ignored") => { setBusy(true); try { await setDesktopEvidenceLifecycle(row.evidence.id, status); onChanged(); } finally { setBusy(false); } };
  return <article className="governance-card">
    <div className="governance-card-main"><div className="button-row"><span className={`history-status history-status--${row.lifecycle.status}`}>{text[row.lifecycle.status]}</span><span className="status-chip">{row.analysis.workStatus}</span><strong>{row.analysis.code ?? "—"}</strong></div><h3>{row.analysis.title ?? row.evidence.sourceName}</h3><p className="muted">{text.source}: {row.evidence.sourceType} · {row.evidence.sourceName} · {text.imported}: {formatDate(row.evidence.importedAt, uiLanguage)}</p></div>
    <div className="governance-metrics"><span>{text.matched}<strong>{row.analysis.summary.matchedEntities}</strong></span><span>{text.newEntities}<strong>{row.analysis.summary.newEntities}</strong></span><span>{text.ambiguous}<strong>{row.analysis.summary.ambiguousEntities}</strong></span><span>{text.conflicts}<strong>{row.analysis.summary.conflictingFields}</strong></span></div>
    <div className="button-row"><button className="primary-button" onClick={onOpen} type="button">{text.open}</button>{row.lifecycle.status === "pending" ? <button disabled={busy} onClick={() => void change("ignored")} type="button">{text.ignore}</button> : null}{row.lifecycle.status === "ignored" ? <button disabled={busy} onClick={() => void change("pending")} type="button">{text.restorePending}</button> : null}</div>
  </article>;
}

function DesktopEvidenceReview({ evidence, repository, privateLibraryPath, onBack, onCommitted, setMessage }: { evidence: EvidenceRecord; repository: TauriLibraryRepository; privateLibraryPath: string | null; onBack: () => void; onCommitted: () => void; setMessage: (message: string) => void }) {
  const { uiLanguage } = useDesktopI18n(); const text = dictionaries[uiLanguage];
  const initial = useStableAsyncData(() => prepareDesktopReview(evidence, repository), [evidence.id, repository]);
  const [analysis, setAnalysis] = useState<EvidenceReviewAnalysis | null>(null); const [decisions, setDecisions] = useState<ReviewDecisions | null>(null); const [built, setBuilt] = useState<BuiltCommitPlan | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (initial.value && !analysis) { setAnalysis(initial.value.analysis); setDecisions(initial.value.decisions); setBuilt(initial.value.built); } }, [initial.value, analysis]);
  if (!analysis || !decisions || !built) return <div><button onClick={onBack} type="button">← {text.back}</button><p className="muted">{text.loading}</p></div>;
  const resolutions = enumerateResolutions(analysis);
  const rebuild = async (next = decisions) => { setBusy(true); try { const result = await rebuildDesktopCommitPlan(evidence, analysis, next, repository); setBuilt(result); } finally { setBusy(false); } };
  const updateField = (field: EvidenceReviewAnalysis["comparisons"][number]["field"], value: "keep_library" | "use_evidence") => { const next = { ...decisions, fields: { ...decisions.fields, [field]: value } }; setDecisions(next); void rebuild(next); };
  const updateEntity = (key: string, action: ReviewDecisions["entities"][number]["action"], targetId?: string) => { const entities = decisions.entities.map((item) => item.key === key ? { key, action, ...(targetId ? { targetId } : {}) } : item); const next = { ...decisions, entities }; setDecisions(next); void rebuild(next); };
  const commit = async () => { if (!privateLibraryPath) return; if (!window.confirm(`${text.commit}: ${built.plan.targetWorkCode}?`)) return; setBusy(true); try { const receipt = await executeDesktopCanonicalCommit(built, evidence, repository, privateLibraryPath); setMessage(`${text.commitDone}: ${receipt.targetWorkCode}`); onCommitted(); } catch (error) { setMessage(String(error instanceof Error ? error.message : error)); } finally { setBusy(false); } };
  return <div className="page-stack"><button className="back-button" onClick={onBack} type="button">← {text.back}</button><section className="settings-card"><span className="eyebrow">EVIDENCE · REVIEW</span><h2>{analysis.code ?? "—"} · {analysis.title ?? evidence.sourceName}</h2><p className="muted">{text.evidenceStatus}: {analysis.workStatus} · {text.source}: {evidence.sourceName}</p></section>
    <section className="settings-card"><h2>{text.fieldDecisions}</h2>{analysis.comparisons.length ? <div className="decision-table">{analysis.comparisons.map((item) => <div className="decision-row" key={item.field}><strong>{item.field}</strong><code>{displayValue(item.libraryValue)}</code><span>←→</span><code>{displayValue(item.evidenceValue)}</code><div className="button-row"><button className={decisions.fields[item.field] === "keep_library" ? "active" : ""} onClick={() => updateField(item.field, "keep_library")} type="button">{text.keepLibrary}</button><button className={decisions.fields[item.field] === "use_evidence" ? "active" : ""} onClick={() => updateField(item.field, "use_evidence")} type="button">{text.useEvidence}</button></div></div>)}</div> : <p className="muted">{text.noFieldChanges}</p>}</section>
    <section className="settings-card"><h2>{text.entityDecisions}</h2>{resolutions.length ? <div className="decision-table">{resolutions.map((item) => { const decision = decisions.entities.find((value) => value.key === item.key); return <div className="entity-decision-row" key={item.key}><div><strong>{item.kind}</strong><span>{item.resolution.sourceValue}</span><small>{item.resolution.status}</small></div><select value={decision?.action ?? "skip"} onChange={(event) => updateEntity(item.key, event.target.value as ReviewDecisions["entities"][number]["action"], decision?.targetId)}><option value="use_match" disabled={!item.resolution.matchedId}>{text.useMatch}</option><option value="create_new" disabled={item.kind === "work_type"}>{text.createNew}</option><option value="skip">{text.skip}</option>{item.resolution.candidates.length ? <option value="bind_existing">{text.bindExisting}</option> : null}</select>{decision?.action === "bind_existing" ? <select value={decision.targetId ?? ""} onChange={(event) => updateEntity(item.key, "bind_existing", event.target.value)}><option value="">—</option>{item.resolution.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select> : null}</div>; })}</div> : <p className="muted">{text.noEntityChanges}</p>}</section>
    <section className="settings-card commit-plan-card"><div className="section-heading"><div><span className="eyebrow">PLAN · FINGERPRINT</span><h2>{text.plan}</h2></div><button disabled={busy} onClick={() => void rebuild()} type="button">{text.rebuild}</button></div><p><strong>{text.target}:</strong> {built.plan.targetWorkCode} · {built.plan.mode === "create" ? text.modeCreate : text.modeUpdate}</p><p className="muted"><strong>{text.fingerprint}:</strong> <code>{built.plan.fingerprint.slice(0, 20)}…</code></p>{built.plan.blockers.length ? <div className="commit-plan-list commit-plan-list--blocker"><h3>{text.blockers}</h3><ul>{built.plan.blockers.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}{built.plan.warnings.length ? <div className="commit-plan-list"><h3>{text.warnings}</h3><ul>{built.plan.warnings.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}<div className="commit-plan-list"><h3>{text.operations}</h3><ol>{built.plan.operations.map((item, index) => <li key={`${item.kind}-${item.entityId}-${index}`}><strong>{item.kind}</strong> · {item.detail}</li>)}</ol></div><button className="primary-button" disabled={busy || !privateLibraryPath || built.plan.blockers.length > 0} onClick={() => void commit()} type="button">{busy ? text.committing : text.commit}</button></section>
  </div>;
}

function DesktopCuration({ repository, openWork, openPerson }: { repository: TauriLibraryRepository; openWork: (id: string) => void; openPerson: (id: string) => void }) {
  const { uiLanguage, metadataLanguage } = useDesktopI18n(); const text = dictionaries[uiLanguage];
  const data = useStableAsyncData(() => buildCurationOverview(repository), [repository]);
  if (data.loading && !data.value) return <p className="muted">{text.loading}</p>; if (!data.value) return <p className="error-text">{text.failed}</p>;
  const value = data.value;
  return <div className="page-stack"><section className="settings-card"><span className="eyebrow">COMPLETENESS · DUPLICATES</span><h2>{text.curation}</h2><p className="muted">{text.curationDesc}</p><div className="stat-grid governance-stat-grid"><Stat label={text.worksAttention} value={value.stats.worksNeedingAttention}/><Stat label={text.peopleAttention} value={value.stats.peopleNeedingAttention}/><Stat label={text.duplicateWorks} value={value.stats.duplicateWorks}/><Stat label={text.duplicatePeople} value={value.stats.duplicatePeople}/></div></section>
    <section className="settings-card"><h2>{text.worksAttention}</h2><div className="compact-governance-table">{value.works.filter((item) => item.completeness.missingIds.length).slice(0, 100).map((item) => <button key={item.work.id} onClick={() => openWork(item.work.id)} type="button"><strong>{item.work.code}</strong><span>{localizeText(item.work.titles, metadataLanguage, item.work.code)}</span><b>{text.score} {item.completeness.score}</b><small>{text.missing}: {item.completeness.missingIds.join(", ")}</small></button>)}</div></section>
    <section className="settings-card"><h2>{text.peopleAttention}</h2><div className="compact-governance-table">{value.people.filter((item) => item.completeness.missingIds.length).slice(0, 100).map((item) => <button key={item.person.id} onClick={() => openPerson(item.person.id)} type="button"><strong>{getPreferredPersonName(item.person, metadataLanguage)}</strong><b>{text.score} {item.completeness.score}</b><small>{text.missing}: {item.completeness.missingIds.join(", ")}</small></button>)}</div></section>
    <section className="settings-card"><h2>{text.duplicates}</h2>{!value.duplicateWorks.length && !value.duplicatePeople.length ? <p className="muted">{text.noDuplicates}</p> : <div className="duplicate-grid">{value.duplicateWorks.map((item) => <article key={item.id}><strong>Work · {item.confidence}</strong><code>{item.leftId}</code><code>{item.rightId}</code><small>{item.reasonIds.join(" · ")}</small></article>)}{value.duplicatePeople.map((item) => <article key={item.id}><strong>Person · {item.confidence}</strong><code>{item.leftId}</code><code>{item.rightId}</code><small>{item.reasonIds.join(" · ")}</small></article>)}</div>}</section>
  </div>;
}

function DesktopHistory({ repository, epoch, onRestored, setMessage }: { repository: TauriLibraryRepository; epoch: number; onRestored: () => void; setMessage: (message: string) => void }) {
  const { uiLanguage } = useDesktopI18n(); const text = dictionaries[uiLanguage]; const data = useStableAsyncData(() => loadDesktopHistory(), [epoch]); const [confirming, setConfirming] = useState<string | null>(null); const [confirmation, setConfirmation] = useState(""); const [busy, setBusy] = useState(false);
  if (data.loading && !data.value) return <p className="muted">{text.loading}</p>; if (!data.value) return <p className="error-text">{text.failed}</p>;
  const restoredIds = new Set(data.value.restores.map((item) => item.commitReceiptId));
  const restore = async (commit: CanonicalCommitReceipt) => { if (confirmation.trim() !== commit.targetWorkCode) return; setBusy(true); try { await restoreDesktopCommit(commit, repository); setMessage(`${text.restoreDone}: ${commit.targetWorkCode}`); setConfirming(null); setConfirmation(""); onRestored(); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } };
  return <section className="settings-card"><span className="eyebrow">COMMIT · SNAPSHOT · RESTORE</span><h2>{text.history}</h2><p className="muted">{text.historyDesc}</p>{!data.value.commits.length ? <p className="muted">{text.noHistory}</p> : <div className="history-list">{data.value.commits.map((commit) => { const restored = restoredIds.has(commit.id); return <article className="history-card" key={commit.id}><div><span className="work-code">{commit.targetWorkCode}</span><strong>{formatDate(commit.committedAt, uiLanguage)}</strong><small>{text.operationsCount}: {commit.operationCount} · {text.snapshot}: {commit.snapshotId ?? "—"}</small></div>{restored ? <span className="history-status history-status--restored">{text.restored}</span> : confirming === commit.id ? <div className="restore-confirm-panel"><label>{text.confirmRestore}<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)}/></label><button className="danger-confirm-button" disabled={busy || confirmation.trim() !== commit.targetWorkCode} onClick={() => void restore(commit)} type="button">{text.restore}</button></div> : <button disabled={!commit.snapshotId} onClick={() => { setConfirming(commit.id); setConfirmation(""); }} type="button">{text.restore}</button>}</article>; })}</div>}</section>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>; }
function displayValue(value: unknown): string { if (Array.isArray(value)) return value.join(", ") || "—"; if (value === null || value === undefined || value === "") return "—"; return String(value); }
function formatDate(value: string, language: string): string { try { return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return value; } }
