"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import type { MediaScanJobSnapshot, MediaScanPhase } from "@/domain/entities/media-scan";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";

const text = {
  ja: {
    scan: "メディアをスキャン", scanning: "スキャン中…", cancel: "キャンセル", cancelling: "キャンセル中…",
    probe: "ffprobe で解析", hash: "SHA-256 を計算（大容量ファイルは時間がかかります）", prune: "消えたファイルを整理",
    failed: "スキャン失敗", noJob: "増分スキャンは size + mtime を比較し、変更がない動画の ffprobe / Hash を再実行しません。",
  },
  "zh-CN": {
    scan: "扫描媒体目录", scanning: "正在扫描…", cancel: "取消扫描", cancelling: "正在取消…",
    probe: "使用 ffprobe 分析媒体", hash: "计算 SHA-256（大文件会比较慢）", prune: "清理已经不存在的文件",
    failed: "扫描失败", noJob: "增量扫描会比较 size + mtime，未变化的视频不会重复执行 ffprobe / Hash。",
  },
  en: {
    scan: "Scan media folders", scanning: "Scanning…", cancel: "Cancel scan", cancelling: "Cancelling…",
    probe: "Analyze with ffprobe", hash: "Compute SHA-256 (slow for large files)", prune: "Remove missing files",
    failed: "Scan failed", noJob: "Incremental scan compares size + mtime and skips ffprobe / hashing for unchanged videos.",
  },
} as const;

const phaseLabel: Record<SupportedLanguage, Record<MediaScanPhase, string>> = {
  ja: { preparing: "準備", discovering: "ファイル探索", comparing: "差分比較", analyzing: "メディア解析", persisting: "保存", pruning: "欠損整理", completed: "完了" },
  "zh-CN": { preparing: "准备", discovering: "发现文件", comparing: "增量比较", analyzing: "媒体分析", persisting: "保存变化", pruning: "清理缺失", completed: "完成" },
  en: { preparing: "Preparing", discovering: "Discovering", comparing: "Comparing", analyzing: "Analyzing", persisting: "Persisting", pruning: "Pruning", completed: "Completed" },
};

export function MediaScanWorkbench({ language, enabled }: { language: SupportedLanguage; enabled: boolean }) {
  const t = text[language];
  const router = useRouter();
  const refreshedJob = useRef<string | null>(null);
  const [probeMedia, setProbeMedia] = useState(true);
  const [computeSha256, setComputeSha256] = useState(false);
  const [pruneMissing, setPruneMissing] = useState(true);
  const [job, setJob] = useState<MediaScanJobSnapshot | null>(null);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/media/scan", { cache: "no-store" });
      const body = await response.json() as { job?: MediaScanJobSnapshot | null; error?: string };
      if (!response.ok) throw new Error(body.error ?? t.failed);
      const next = body.job ?? null;
      setJob(next);
      if (next?.status === "completed" && refreshedJob.current !== next.id) {
        refreshedJob.current = next.id;
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [router, t.failed]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus]);

  useEffect(() => {
    if (job?.status !== "running" && job?.status !== "cancelling") return;
    const timer = window.setInterval(() => void loadStatus(), 800);
    return () => window.clearInterval(timer);
  }, [job?.status, loadStatus]);

  async function scan() {
    setError("");
    try {
      const response = await fetch("/api/media/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ probeMedia, computeSha256, pruneMissing }),
      });
      const body = await response.json() as { job?: MediaScanJobSnapshot; error?: string };
      if (!response.ok) throw new Error(body.error ?? t.failed);
      setJob(body.job ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      await loadStatus();
    }
  }

  async function cancel() {
    setError("");
    try {
      const response = await fetch("/api/media/scan", { method: "DELETE" });
      const body = await response.json() as { job?: MediaScanJobSnapshot | null; error?: string };
      if (!response.ok) throw new Error(body.error ?? t.failed);
      setJob(body.job ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  const running = job?.status === "running" || job?.status === "cancelling";
  const total = job?.progress.total ?? 0;
  const current = job?.progress.current ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : running ? 4 : 0;

  return <section className="settings-card media-scan-card">
    <div className="section-heading-row">
      <div><span className="eyebrow">INCREMENTAL · PLATFORM PORTS · CANCELLABLE</span><h2>{language === "zh-CN" ? "增量媒体扫描" : language === "ja" ? "増分メディアスキャン" : "Incremental media scan"}</h2></div>
      {running ? <span className="status-chip status-chip--warn">{job.status}</span> : null}
    </div>

    <div className="media-scan-options">
      <label><input checked={probeMedia} disabled={running} onChange={(e: ChangeEvent<HTMLInputElement>)=>setProbeMedia(e.target.checked)} type="checkbox" /> {t.probe}</label>
      <label><input checked={computeSha256} disabled={running} onChange={(e: ChangeEvent<HTMLInputElement>)=>setComputeSha256(e.target.checked)} type="checkbox" /> {t.hash}</label>
      <label><input checked={pruneMissing} disabled={running} onChange={(e: ChangeEvent<HTMLInputElement>)=>setPruneMissing(e.target.checked)} type="checkbox" /> {t.prune}</label>
    </div>

    <div className="media-scan-actions">
      <button className="primary-button" disabled={!enabled || running} onClick={()=>void scan()} type="button">{running ? t.scanning : t.scan}</button>
      {running ? <button className="secondary-button" disabled={job?.status === "cancelling"} onClick={()=>void cancel()} type="button">{job?.status === "cancelling" ? t.cancelling : t.cancel}</button> : null}
    </div>

    {job ? <div className="scan-progress-panel">
      <div className="scan-progress-row"><strong>{phaseLabel[language][job.progress.phase]}</strong><span>{current}/{total || "—"}</span></div>
      <div aria-label="scan progress" className="scan-progress-track"><span style={{ width: `${percent}%` }} /></div>
      <p className="muted">{job.progress.fileName ? `${job.progress.fileName} · ` : ""}{job.progress.message ?? ""}</p>
      {job.result ? <div className="scan-result-grid">
        <small>discovered <strong>{job.result.discovered}</strong></small>
        <small>added <strong>{job.result.added}</strong></small>
        <small>updated <strong>{job.result.updated}</strong></small>
        <small>unchanged <strong>{job.result.unchanged}</strong></small>
        <small>probed <strong>{job.result.probed}</strong></small>
        <small>hashed <strong>{job.result.hashed}</strong></small>
        <small>sidecars <strong>{job.result.sidecarUpdated}</strong></small>
        <small>removed <strong>{job.result.removed}</strong></small>
      </div> : null}
      {job.error ? <p className="error-text">{job.error}</p> : null}
      {job.result?.warnings.length ? <details><summary>warnings ({job.result.warnings.length})</summary><ul className="compact-list">{job.result.warnings.slice(0, 20).map((item)=><li key={item}>{item}</li>)}</ul></details> : null}
    </div> : <p className="muted">{t.noJob}</p>}

    {error ? <p className="error-text">{error}</p> : null}
  </section>;
}
