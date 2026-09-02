"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import { getHistoryDictionary } from "@/i18n/history";

interface HistoryRestoreWorkbenchProps {
  commitReceiptId: string;
  targetWorkCode: string;
  language: SupportedLanguage;
  allowed: boolean;
  blockers: string[];
  alreadyRestored: boolean;
  privateLibraryConfigured: boolean;
}

export function HistoryRestoreWorkbench({
  commitReceiptId,
  targetWorkCode,
  language,
  allowed,
  blockers,
  alreadyRestored,
  privateLibraryConfigured,
}: HistoryRestoreWorkbenchProps) {
  const text = getHistoryDictionary(language);
  const router = useRouter();
  const [prepared, setPrepared] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const canRestore = allowed && !alreadyRestored && privateLibraryConfigured;

  async function restore() {
    if (confirmation.trim() !== targetWorkCode) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/history/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commitReceiptId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Snapshot 恢复失败。");
      setMessage(text.restoreSuccess);
      setPrepared(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Snapshot 恢复失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="detail-section restore-workbench">
      <div>
        <span className="eyebrow">RECOVERY · SNAPSHOT</span>
        <h2>{text.restoreTitle}</h2>
        <p className="muted">{text.restoreDescription}</p>
      </div>

      {!privateLibraryConfigured ? (
        <div className="learning-panel"><strong>{text.restoreBlocked}</strong><p>LOCALOGUE_LIBRARY_PATH 未配置。</p></div>
      ) : null}

      {blockers.length ? (
        <div className="commit-plan-list commit-plan-list--blocker">
          <h3>{text.restoreBlocked}</h3>
          <ul>{blockers.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ) : null}

      {canRestore && !prepared ? (
        <button className="secondary-button" type="button" onClick={() => setPrepared(true)}>
          {text.restorePrepare}
        </button>
      ) : null}

      {canRestore && prepared ? (
        <div className="restore-confirm-panel">
          <label>
            <span>{text.restoreConfirmLabel}: <code>{targetWorkCode}</code></span>
            <input value={confirmation} onChange={(event: { target: { value: string } }) => setConfirmation(event.target.value)} autoComplete="off" />
          </label>
          <button
            className="danger-confirm-button"
            type="button"
            disabled={loading || confirmation.trim() !== targetWorkCode}
            onClick={restore}
          >
            {loading ? text.restoring : text.restoreConfirm}
          </button>
        </div>
      ) : null}

      {message ? <div className="import-message">{message}</div> : null}
    </section>
  );
}
