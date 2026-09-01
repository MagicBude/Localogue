"use client";

import Link from "next/link";
import { useState, type ChangeEvent } from "react";

import type { ImportPreview } from "@/domain/entities/evidence";
import type { UiDictionary } from "@/i18n/ui";
import { formatImportWarning } from "@/i18n/import-warnings";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";

interface ImportWorkbenchProps {
  dictionary: UiDictionary;
  uiLanguage: SupportedLanguage;
}

type ImportState = "idle" | "previewing" | "ready" | "saving" | "saved" | "error";

/**
 * 导入工作台只负责“选择输入 → 请求预览 → 展示结果 → 保存 Evidence”。
 *
 * Parser 放在 Route Handler 的 Node.js 端，而不是塞进浏览器组件，原因是：
 * - XLSX / NFO 解析属于基础设施职责；
 * - 后续文件夹扫描也必须在本地服务端完成；
 * - 浏览器只需要关心交互状态，不应该承担资料库写盘权限。
 */
export function ImportWorkbench({ dictionary, uiLanguage }: ImportWorkbenchProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pastedJson, setPastedJson] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [state, setState] = useState<ImportState>("idle");
  const [message, setMessage] = useState("");

  async function requestPreview(selected: File) {
    setState("previewing");
    setMessage("");
    setPreview(null);

    try {
      const formData = new FormData();
      formData.set("file", selected);

      const response = await fetch("/api/import/preview", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as ImportPreview | { error?: string };
      if (!response.ok || !("candidates" in body)) {
        throw new Error("error" in body ? body.error : dictionary.importPreviewFailed);
      }

      setPreview(body);
      setState("ready");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : dictionary.importPreviewFailed);
    }
  }

  async function handleFilePreview() {
    if (!file) {
      setState("error");
      setMessage(dictionary.importNoFile);
      return;
    }
    await requestPreview(file);
  }

  async function handlePastedJsonPreview() {
    if (!pastedJson.trim()) {
      setState("error");
      setMessage(dictionary.importNoJson);
      return;
    }

    const virtualFile = new File([pastedJson], "pasted-metadata.json", {
      type: "application/json",
    });
    await requestPreview(virtualFile);
  }

  async function handleSaveEvidence() {
    if (!preview) return;
    setState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/import/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });
      const body = (await response.json()) as { saved?: number; error?: string };
      if (!response.ok) throw new Error(body.error ?? dictionary.importSaveFailed);

      setState("saved");
      setMessage(`${dictionary.importSaved} (${body.saved ?? 0})`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : dictionary.importSaveFailed);
    }
  }

  return (
    <div className="import-workbench">
      <section className="import-source-card">
        <div>
          <span className="eyebrow">FILE IMPORT</span>
          <h2>{dictionary.chooseFile}</h2>
          <p className="muted">{dictionary.importFileHelp}</p>
        </div>
        <input
          accept=".json,.nfo,.csv,.xlsx"
          onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)}
          type="file"
        />
        <button
          className="primary-button"
          disabled={state === "previewing"}
          onClick={handleFilePreview}
          type="button"
        >
          {state === "previewing" ? dictionary.importParsing : dictionary.previewImport}
        </button>
      </section>

      <section className="import-source-card">
        <div>
          <span className="eyebrow">PASTE JSON</span>
          <h2>{dictionary.pasteJson}</h2>
          <p className="muted">{dictionary.importPasteHelp}</p>
        </div>
        <textarea
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPastedJson(event.target.value)}
          placeholder={'{\n  "code": "DEMO-001",\n  "title": "示例标题"\n}'}
          rows={10}
          value={pastedJson}
        />
        <button
          className="secondary-button"
          disabled={state === "previewing"}
          onClick={handlePastedJsonPreview}
          type="button"
        >
          {dictionary.previewImport}
        </button>
      </section>

      {message ? (
        <div className={`import-message import-message--${state}`}>
          <span>{message}</span>
          {state === "saved" ? (
            <Link href="/review">{dictionary.openReviewInbox}</Link>
          ) : null}
        </div>
      ) : null}

      {preview ? (
        <section className="import-preview" id="import-preview">
          <div className="section-heading section-heading--action">
            <div>
              <span className="eyebrow">EVIDENCE PREVIEW</span>
              <h2>{dictionary.importPreview}</h2>
              <p className="muted">
                {dictionary.sourceFormat}: {preview.sourceType} · {dictionary.candidateCount}: {preview.candidateCount}
              </p>
            </div>
            <button
              className="primary-button"
              disabled={state === "saving" || state === "saved"}
              onClick={handleSaveEvidence}
              type="button"
            >
              {state === "saving" ? dictionary.importSaving : dictionary.saveEvidence}
            </button>
          </div>

          {preview.warnings.length ? (
            <div className="import-warning-box">
              <strong>{dictionary.importWarnings}</strong>
              <ul>{preview.warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>{formatImportWarning(warning, uiLanguage)}</li>)}</ul>
            </div>
          ) : null}

          <div className="import-candidate-list">
            {preview.candidates.slice(0, 100).map((candidate) => (
              <article className="import-candidate" key={candidate.index}>
                <div className="import-candidate__summary">
                  <span className="work-code">#{candidate.index}</span>
                  <strong>{candidate.normalized.code ?? dictionary.importUnknownCode}</strong>
                  <span>{candidate.normalized.title ?? candidate.normalized.originalTitle ?? dictionary.importUnknownTitle}</span>
                  <small>
                    {candidate.normalized.releaseDate ?? dictionary.importUnknownDate} · {candidate.normalized.durationMinutes ?? "—"} {dictionary.minutes}
                  </small>
                </div>

                {candidate.warnings.length ? (
                  <div className="import-candidate__warnings">
                    {candidate.warnings.map((warning, index) => <span key={`${warning.code}-${index}`}>{formatImportWarning(warning, uiLanguage)}</span>)}
                  </div>
                ) : null}

                <details>
                  <summary>{dictionary.normalizedData}</summary>
                  <pre>{JSON.stringify(candidate.normalized, null, 2)}</pre>
                </details>
                <details>
                  <summary>{dictionary.rawData}</summary>
                  <pre>{JSON.stringify(candidate.raw, null, 2)}</pre>
                </details>
              </article>
            ))}
          </div>

          {preview.candidateCount > 100 ? (
            <p className="muted">{dictionary.importPreviewLimit}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
