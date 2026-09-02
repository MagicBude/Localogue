"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { EvidenceLifecycleStatus } from "@/domain/entities/evidence-lifecycle";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import { getLifecycleDictionary } from "@/i18n/lifecycle";

interface EvidenceLifecycleActionsProps {
  evidenceId: string;
  status: EvidenceLifecycleStatus;
  language: SupportedLanguage;
}

export function EvidenceLifecycleActions({ evidenceId, status, language }: EvidenceLifecycleActionsProps) {
  const text = getLifecycleDictionary(language);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function update(next: "pending" | "ignored") {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/review/lifecycle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evidenceId, status: next }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Evidence 生命周期更新失败。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evidence 生命周期更新失败。");
    } finally {
      setLoading(false);
    }
  }

  const hint = status === "committed" ? text.committedHint : status === "ignored" ? text.ignoredHint : text.pendingHint;
  return (
    <section className="detail-section lifecycle-panel">
      <div>
        <span className={`history-status history-status--${status}`}>{text[status]}</span>
        <p className="muted">{hint}</p>
      </div>
      {status === "pending" ? (
        <button className="secondary-button" type="button" disabled={loading} onClick={() => update("ignored")}>{text.ignore}</button>
      ) : null}
      {status === "ignored" ? (
        <button className="secondary-button" type="button" disabled={loading} onClick={() => update("pending")}>{text.restorePending}</button>
      ) : null}
      {message ? <div className="import-message">{message}</div> : null}
    </section>
  );
}
