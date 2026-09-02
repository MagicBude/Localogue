"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import type { SupportedLanguage } from "@/domain/value-objects/localized-text";

const text = {
  ja: { scan: "メディアをスキャン", scanning: "スキャン中…", probe: "ffprobe で解析", hash: "SHA-256 を計算（大容量ファイルは時間がかかります）", prune: "消えたファイルを整理", done: "スキャン完了", failed: "スキャン失敗" },
  "zh-CN": { scan: "扫描媒体目录", scanning: "正在扫描…", probe: "使用 ffprobe 分析媒体", hash: "计算 SHA-256（大文件会比较慢）", prune: "清理已经不存在的文件", done: "扫描完成", failed: "扫描失败" },
  en: { scan: "Scan media folders", scanning: "Scanning…", probe: "Analyze with ffprobe", hash: "Compute SHA-256 (slow for large files)", prune: "Remove missing files", done: "Scan complete", failed: "Scan failed" },
} as const;

export function MediaScanWorkbench({ language, enabled }: { language: SupportedLanguage; enabled: boolean }) {
  const t = text[language];
  const router = useRouter();
  const [probeMedia, setProbeMedia] = useState(true);
  const [computeSha256, setComputeSha256] = useState(false);
  const [pruneMissing, setPruneMissing] = useState(true);
  const [status, setStatus] = useState<"idle"|"running"|"done"|"error">("idle");
  const [message, setMessage] = useState("");

  async function scan() {
    setStatus("running"); setMessage("");
    try {
      const response = await fetch("/api/media/scan", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ probeMedia, computeSha256, pruneMissing }),
      });
      const body = await response.json() as { error?: string; discovered?: number; matched?: number; unmatched?: number; warnings?: string[] };
      if (!response.ok) throw new Error(body.error ?? t.failed);
      setStatus("done");
      setMessage(`${t.done}: ${body.discovered ?? 0} · matched ${body.matched ?? 0} · unmatched ${body.unmatched ?? 0}${body.warnings?.length ? ` · warnings ${body.warnings.length}` : ""}`);
      router.refresh();
    } catch (error) {
      setStatus("error"); setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return <section className="settings-card">
    <div className="media-scan-options">
      <label><input checked={probeMedia} onChange={(e: ChangeEvent<HTMLInputElement>)=>setProbeMedia(e.target.checked)} type="checkbox" /> {t.probe}</label>
      <label><input checked={computeSha256} onChange={(e: ChangeEvent<HTMLInputElement>)=>setComputeSha256(e.target.checked)} type="checkbox" /> {t.hash}</label>
      <label><input checked={pruneMissing} onChange={(e: ChangeEvent<HTMLInputElement>)=>setPruneMissing(e.target.checked)} type="checkbox" /> {t.prune}</label>
    </div>
    <button className="primary-button" disabled={!enabled || status === "running"} onClick={scan} type="button">{status === "running" ? t.scanning : t.scan}</button>
    {message ? <p className={status === "error" ? "error-text" : "success-text"}>{message}</p> : null}
  </section>;
}
