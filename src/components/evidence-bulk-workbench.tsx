"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface EvidenceBulkRow {
  id: string;
  code?: string;
  title?: string;
  sourceName: string;
  status: "pending" | "ignored";
}

interface EvidenceBulkWorkbenchProps {
  rows: EvidenceBulkRow[];
  language: "ja" | "zh-CN" | "en";
}

const text = {
  ja: {
    selected: "選択",
    selectAll: "すべて選択",
    ignore: "選択を保留",
    restore: "選択を未レビューへ戻す",
    source: "ソース",
    empty: "一括処理できる Evidence はありません。",
    failed: "一括更新に失敗しました。",
    working: "更新中…",
  },
  "zh-CN": {
    selected: "已选择",
    selectAll: "全选",
    ignore: "批量忽略",
    restore: "批量恢复待审核",
    source: "来源",
    empty: "当前没有可批量治理的 Evidence。",
    failed: "批量更新失败。",
    working: "处理中…",
  },
  en: {
    selected: "Selected",
    selectAll: "Select all",
    ignore: "Ignore selected",
    restore: "Restore selected to pending",
    source: "Source",
    empty: "There is no Evidence available for bulk curation.",
    failed: "Bulk update failed.",
    working: "Updating…",
  },
} as const;

/**
 * Evidence 批量治理仍然只修改 Lifecycle，不修改 Evidence 原始文件。
 *
 * 这是 V1-07 “Evidence 本体不可变”原则在批量操作中的延续。
 */
export function EvidenceBulkWorkbench({ rows, language }: EvidenceBulkWorkbenchProps) {
  const router = useRouter();
  const t = text[language];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(row.id)),
    [rows, selected],
  );
  const canIgnore = selectedRows.some((row) => row.status === "pending");
  const canRestore = selectedRows.some((row) => row.status === "ignored");

  const toggleAll = () => {
    setSelected((current) =>
      current.size === rows.length ? new Set() : new Set(rows.map((row) => row.id)),
    );
  };

  const apply = async (status: "pending" | "ignored") => {
    const ids = selectedRows
      .filter((row) => (status === "ignored" ? row.status === "pending" : row.status === "ignored"))
      .map((row) => row.id);
    if (!ids.length) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/evidence/lifecycle-bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
      if (!response.ok) throw new Error(await response.text());
      setSelected(new Set());
      router.refresh();
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  if (!rows.length) return <p className="muted">{t.empty}</p>;

  return (
    <div className="evidence-bulk-workbench">
      <div className="evidence-bulk-toolbar">
        <label className="bulk-select-all">
          <input
            checked={selected.size === rows.length && rows.length > 0}
            onChange={toggleAll}
            type="checkbox"
          />
          {t.selectAll}
        </label>
        <span>{t.selected}: <strong>{selected.size}</strong></span>
        <button className="secondary-button" disabled={busy || !canIgnore} onClick={() => void apply("ignored")} type="button">
          {busy ? t.working : t.ignore}
        </button>
        <button className="secondary-button" disabled={busy || !canRestore} onClick={() => void apply("pending")} type="button">
          {busy ? t.working : t.restore}
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="evidence-bulk-table-wrap">
        <table className="evidence-bulk-table">
          <thead><tr><th></th><th>Evidence</th><th>Code</th><th>Title</th><th>{t.source}</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><input checked={selected.has(row.id)} onChange={() => setSelected((current) => {
                  const next = new Set(current);
                  if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
                  return next;
                })} type="checkbox" /></td>
                <td><code>{row.id}</code></td>
                <td>{row.code ?? "—"}</td>
                <td>{row.title ?? "—"}</td>
                <td>{row.sourceName}</td>
                <td><span className={`history-status history-status--${row.status}`}>{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
