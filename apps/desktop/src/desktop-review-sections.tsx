import { enumerateResolutions } from "@/application/review/review-decision-service";
import type { BuiltCommitPlan } from "@/application/review/commit-plan-service";
import type { EntityReviewAction, ReviewDecisions } from "@/domain/entities/commit-plan";
import type { EvidenceReviewAnalysis, ReviewFieldComparison } from "@/domain/entities/review";

import { useDesktopI18n } from "./desktop-i18n";

/** Review Section 是纯表单展示：它们只产生新的 Decisions，不读取或写入资料库。 */
export function FieldDecisionTable({ comparisons, decisions, onChange }: { comparisons: ReviewFieldComparison[]; decisions: ReviewDecisions; onChange: (next: ReviewDecisions) => void }) {
  const { t } = useDesktopI18n();
  const actionable = comparisons.filter((item) => item.status !== "same");
  if (!actionable.length) return null;
  return <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">FIELD DECISIONS</span><h2>{t("字段决策")}</h2></div></div><div className="governance-field-table">{actionable.map((item) => <div className="governance-field-row" key={item.field}><strong>{item.field}</strong><span>{renderValue(item.libraryValue)}</span><span>{renderValue(item.evidenceValue)}</span><select value={decisions.fields[item.field] ?? ""} onChange={(event) => onChange({ ...decisions, fields: { ...decisions.fields, [item.field]: event.target.value as "keep_library" | "use_evidence" } })}><option value="">{t("请选择")}</option><option value="keep_library">{t("保留 Library")}</option><option value="use_evidence">{t("采用 Evidence")}</option></select></div>)}</div></section>;
}

export function EntityDecisionList({ analysis, decisions, onChange }: { analysis: EvidenceReviewAnalysis; decisions: ReviewDecisions; onChange: (next: ReviewDecisions) => void }) {
  const { t } = useDesktopI18n();
  const items = enumerateResolutions(analysis);
  if (!items.length) return null;
  const byKey = new Map(decisions.entities.map((item) => [item.key, item]));
  return <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">ENTITY RESOLUTION</span><h2>{t("实体决策")}</h2></div></div><div className="governance-resolution-list">{items.map((item) => { const decision = byKey.get(item.key); return <div className="governance-resolution-row" key={item.key}><span><b>{item.kind}</b><small>{item.resolution.sourceValue}</small></span><span className={`governance-status is-${item.resolution.status}`}>{item.resolution.status}</span><select value={encodeEntityDecision(decision)} onChange={(event) => { const next = decodeEntityDecision(item.key, event.target.value); onChange({ ...decisions, entities: [...decisions.entities.filter((value) => value.key !== item.key), ...(next ? [next] : [])] }); }}><option value="">{t("请选择")}</option>{item.resolution.matchedId ? <option value={`use_match:${item.resolution.matchedId}`}>{t("使用匹配")}：{item.resolution.matchedLabel ?? item.resolution.matchedId}</option> : null}{item.resolution.candidates.map((candidate) => <option key={candidate.id} value={`bind_existing:${candidate.id}`}>{t("绑定")}：{candidate.label}</option>)}{item.kind !== "work_type" ? <option value="create_new">{t("创建新实体")}</option> : null}<option value="skip">{t("跳过")}</option></select></div>; })}</div></section>;
}

export function CommitPlanView({ built, onCommit, busy }: { built: BuiltCommitPlan; onCommit: () => void; busy: boolean }) {
  const { t } = useDesktopI18n();
  return <div className="governance-plan"><div className="governance-plan-head"><strong>{built.plan.mode === "create" ? t("创建") : t("更新")} {built.plan.targetWorkCode}</strong><code>{built.plan.fingerprint.slice(0, 16)}…</code></div>{built.plan.blockers.length ? <ul className="governance-blockers">{built.plan.blockers.map((item) => <li key={item}>{item}</li>)}</ul> : null}{built.plan.warnings.length ? <ul>{built.plan.warnings.map((item) => <li key={item}>{item}</li>)}</ul> : null}<ol>{built.plan.operations.map((item, index) => <li key={`${item.kind}:${item.entityId}:${index}`}><b>{item.kind}</b> · {item.label}<small>{item.detail}</small></li>)}</ol><button className="primary-button" disabled={busy || built.plan.blockers.length > 0} onClick={onCommit}>{t("确认执行 Commit")}</button></div>;
}

function renderValue(value: unknown): string { if (value === null || value === undefined) return "—"; if (Array.isArray(value)) return value.length ? value.join(" / ") : "—"; return String(value); }
function encodeEntityDecision(decision: ReviewDecisions["entities"][number] | undefined): string { if (!decision) return ""; return decision.targetId ? `${decision.action}:${decision.targetId}` : decision.action; }
function decodeEntityDecision(key: string, encoded: string): ReviewDecisions["entities"][number] | null { if (!encoded) return null; const [actionRaw, targetId] = encoded.split(":", 2); return { key, action: actionRaw as EntityReviewAction, ...(targetId ? { targetId } : {}) }; }
