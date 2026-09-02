"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  createDefaultReviewDecisions,
  entityDecisionKey,
} from "@/application/review/review-decision-service";
import type { EvidenceLifecycleStatus } from "@/domain/entities/evidence-lifecycle";
import type {
  CanonicalCommitPlan,
  CanonicalCommitReceipt,
  EntityReviewAction,
  ReviewDecisions,
} from "@/domain/entities/commit-plan";
import type {
  EntityResolution,
  EvidenceReviewAnalysis,
} from "@/domain/entities/review";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import { getCommitDictionary } from "@/i18n/commit";
import { formatReviewField } from "@/i18n/review";

interface ReviewCommitWorkbenchProps {
  analysis: EvidenceReviewAnalysis;
  language: SupportedLanguage;
  privateLibraryConfigured: boolean;
  existingReceipt: CanonicalCommitReceipt | null;
  lifecycleStatus: EvidenceLifecycleStatus;
}

type ResolutionKind =
  | "performer"
  | "director"
  | "maker"
  | "label"
  | "series"
  | "genre"
  | "tag"
  | "work_type";

interface ResolutionItem {
  kind: ResolutionKind;
  index: number;
  resolution: EntityResolution;
}

export function ReviewCommitWorkbench({
  analysis,
  language,
  privateLibraryConfigured,
  existingReceipt,
  lifecycleStatus,
}: ReviewCommitWorkbenchProps) {
  const text = getCommitDictionary(language);
  const [decisions, setDecisions] = useState<ReviewDecisions>(() =>
    createDefaultReviewDecisions(analysis),
  );
  const [plan, setPlan] = useState<CanonicalCommitPlan | null>(null);
  const [receipt, setReceipt] = useState<CanonicalCommitReceipt | null>(existingReceipt);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<"plan" | "commit" | null>(null);

  const resolutionItems = useMemo(() => enumerateResolutionItems(analysis), [analysis]);

  async function generatePlan() {
    setLoading("plan");
    setMessage("");
    try {
      const response = await fetch("/api/review/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evidenceId: analysis.evidenceId, decisions }),
      });
      const payload = (await response.json()) as {
        plan?: CanonicalCommitPlan;
        alreadyCommitted?: CanonicalCommitReceipt | null;
        error?: string;
      };
      if (!response.ok || !payload.plan) {
        throw new Error(payload.error ?? "Commit Plan 生成失败。");
      }
      setPlan(payload.plan);
      if (payload.alreadyCommitted) setReceipt(payload.alreadyCommitted);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Commit Plan 生成失败。");
    } finally {
      setLoading(null);
    }
  }

  async function commitPlan() {
    if (!plan) return;
    setLoading("commit");
    setMessage("");
    try {
      const response = await fetch("/api/review/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          evidenceId: analysis.evidenceId,
          decisions,
          fingerprint: plan.fingerprint,
        }),
      });
      const payload = (await response.json()) as {
        receipt?: CanonicalCommitReceipt;
        error?: string;
      };
      if (!response.ok || !payload.receipt) {
        throw new Error(payload.error ?? "Canonical Commit 执行失败。");
      }
      setReceipt(payload.receipt);
      setMessage(text.committed);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Canonical Commit 执行失败。");
      // 出错后强制丢弃旧 Plan，避免用户再次提交一个可能已经过期的 fingerprint。
      setPlan(null);
    } finally {
      setLoading(null);
    }
  }

  function setFieldDecision(
    field: keyof ReviewDecisions["fields"],
    value: "keep_library" | "use_evidence",
  ) {
    setDecisions((current) => ({
      ...current,
      fields: { ...current.fields, [field]: value },
    }));
    setPlan(null);
  }

  function setEntityDecision(key: string, encodedValue: string) {
    setDecisions((current) => {
      if (!encodedValue) {
        return {
          ...current,
          entities: current.entities.filter((item) => item.key !== key),
        };
      }

      const [action, targetId] = encodedValue.split("::") as [EntityReviewAction, string?];
      const next = { key, action, targetId: targetId || undefined };
      const exists = current.entities.some((item) => item.key === key);
      return {
        ...current,
        entities: exists
          ? current.entities.map((item) => (item.key === key ? next : item))
          : [...current.entities, next],
      };
    });
    setPlan(null);
  }

  return (
    <section className="detail-section commit-workbench" id="commit-workbench">
      <div className="commit-workbench__heading">
        <div>
          <span className="eyebrow">CURATION · COMMIT</span>
          <h2>{text.title}</h2>
          <p className="muted">{text.description}</p>
        </div>
      </div>

      {!privateLibraryConfigured ? (
        <div className="learning-panel commit-demo-warning">
          <h3>{text.demoTitle}</h3>
          <p>{text.demoBody}</p>
          <pre>LOCALOGUE_LIBRARY_PATH=./data/library</pre>
        </div>
      ) : null}

      {receipt ? (
        <div className="commit-success-panel">
          <strong>{text.alreadyCommitted}</strong>
          <span>{receipt.targetWorkCode} · {formatTimestamp(receipt.committedAt, language)}</span>
          <Link className="secondary-button" href={`/works/${receipt.targetWorkId}`}>
            {text.openWork}
          </Link>
          <Link className="secondary-button" href={`/history/${receipt.id}`}>
            {text.openHistory}
          </Link>
        </div>
      ) : null}

      <div className="commit-decision-grid">
        <div className="commit-decision-panel">
          <h3>{text.fieldDecisions}</h3>
          {!analysis.comparisons.filter((item) => item.status !== "same").length ? (
            <p className="muted">{text.noChanges}</p>
          ) : null}
          {analysis.comparisons
            .filter((comparison) => comparison.status !== "same")
            .map((comparison) => {
              const current = decisions.fields[comparison.field] ??
                (comparison.status === "library_only" ? "keep_library" : "use_evidence");
              return (
                <label className="commit-decision-row" key={comparison.field}>
                  <span>
                    <strong>{formatReviewField(comparison.field, language)}</strong>
                    <small>{comparison.status}</small>
                  </span>
                  <select
                    value={current}
                    onChange={(event: { target: { value: string } }) =>
                      setFieldDecision(
                        comparison.field,
                        event.target.value as "keep_library" | "use_evidence",
                      )
                    }
                  >
                    <option value="keep_library">{text.keepLibrary}</option>
                    <option value="use_evidence">{text.useEvidence}</option>
                  </select>
                </label>
              );
            })}
        </div>

        <div className="commit-decision-panel">
          <h3>{text.entityDecisions}</h3>
          {!resolutionItems.length ? <p className="muted">—</p> : null}
          {resolutionItems.map((item) => {
            const key = entityDecisionKey(item.kind, item.index, item.resolution.sourceValue);
            const decision = decisions.entities.find((value) => value.key === key);
            const encoded = decision
              ? `${decision.action}::${decision.targetId ?? ""}`
              : "";

            return (
              <label className="commit-decision-row" key={key}>
                <span>
                  <strong>{item.resolution.sourceValue}</strong>
                  <small>{item.kind} · {item.resolution.status}</small>
                </span>
                <select value={encoded} onChange={(event: { target: { value: string } }) => setEntityDecision(key, event.target.value)}>
                  {!decision ? <option value="">— 请选择明确决策 —</option> : null}
                  {item.resolution.matchedId ? (
                    <option value={`use_match::${item.resolution.matchedId}`}>
                      {text.useMatch}: {item.resolution.matchedLabel ?? item.resolution.matchedId}
                    </option>
                  ) : null}
                  {item.resolution.candidates.map((candidate) => (
                    <option value={`bind_existing::${candidate.id}`} key={candidate.id}>
                      {text.chooseCandidate}: {candidate.label}
                    </option>
                  ))}
                  {item.kind !== "work_type" ? (
                    <option value="create_new::">{text.createNew}</option>
                  ) : null}
                  <option value="skip::">{text.skip}</option>
                </select>
              </label>
            );
          })}
        </div>
      </div>

      <div className="commit-workbench__actions">
        <button
          className="primary-button"
          type="button"
          onClick={generatePlan}
          disabled={loading !== null || Boolean(receipt) || lifecycleStatus === "ignored"}
        >
          {loading === "plan" ? text.generating : text.generatePlan}
        </button>
        <span className="muted">{text.safety}</span>
      </div>

      {message ? <div className="import-message">{message}</div> : null}

      {plan ? (
        <div className="commit-plan-panel">
          <div className="commit-plan-panel__heading">
            <div>
              <h3>{text.planTitle}</h3>
              <p className="muted">
                {plan.mode === "create" ? "CREATE" : "UPDATE"} · {plan.targetWorkCode} · fingerprint {plan.fingerprint.slice(0, 12)}…
              </p>
            </div>
            <strong>{plan.operations.length}</strong>
          </div>

          {plan.blockers.length ? (
            <div className="commit-plan-list commit-plan-list--blocker">
              <h4>{text.blockers}</h4>
              <ul>{plan.blockers.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}

          {plan.warnings.length ? (
            <div className="commit-plan-list">
              <h4>{text.warnings}</h4>
              <ul>{plan.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}

          <div className="commit-operation-list">
            <h4>{text.operations}</h4>
            {plan.operations.map((operation, index) => (
              <article key={`${operation.kind}-${operation.entityId}-${index}`}>
                <span className="work-code">{operation.kind}</span>
                <div>
                  <strong>{operation.label}</strong>
                  <p>{operation.detail}</p>
                </div>
              </article>
            ))}
          </div>

          <button
            className="primary-button danger-confirm-button"
            type="button"
            disabled={Boolean(plan.blockers.length) || loading !== null || Boolean(receipt)}
            onClick={commitPlan}
          >
            {loading === "commit" ? text.committing : text.confirm}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function enumerateResolutionItems(analysis: EvidenceReviewAnalysis): ResolutionItem[] {
  const items: ResolutionItem[] = [];
  const add = (kind: ResolutionKind, values: EntityResolution[]) =>
    values.forEach((resolution, index) => items.push({ kind, index, resolution }));

  add("performer", analysis.performers);
  add("director", analysis.directors);
  add("maker", analysis.maker ? [analysis.maker] : []);
  add("label", analysis.label ? [analysis.label] : []);
  add("series", analysis.series);
  add("genre", analysis.genres);
  add("tag", analysis.tags);
  add("work_type", analysis.workTypes);
  return items;
}

function formatTimestamp(value: string, language: SupportedLanguage): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale = language === "ja" ? "ja-JP" : language === "zh-CN" ? "zh-CN" : "en-US";
  return date.toLocaleString(locale);
}
