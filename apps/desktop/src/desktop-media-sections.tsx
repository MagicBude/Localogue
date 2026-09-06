import type { MediaScanJobSnapshot } from "@/domain/entities/media-scan";
import type { MediaScanHistoryEntry } from "@/domain/entities/media-scan-history";

import { useDesktopI18n } from "./desktop-i18n";
import { InfoCard } from "./desktop-page-primitives";
import type { DesktopMediaProbeResult, DesktopTaskProgress } from "./contracts";

/**
 * 纯展示组件只接收数据和回调，不创建 Coordinator，也不写 Repository。
 * 初学时可以把它理解为：页面控制器决定“做什么”，Section 只决定“怎样显示”。
 */
export function MediaScanSection({ roots, scan, onStart, onCancel }: {
  roots: string[];
  scan: MediaScanJobSnapshot | null;
  onStart: () => void;
  onCancel: () => void;
}) {
  const { t } = useDesktopI18n();
  const running = scan?.status === "running" || scan?.status === "cancelling";
  return <section className="settings-card">
    <div className="section-heading"><div><span className="eyebrow">INCREMENTAL MEDIA SCAN</span><h2>{t("媒体扫描")}</h2><p className="muted">{t("递归扫描 Unified Roots + 高级媒体路径。未变化文件继续走 V1-12 Fast Path。")}</p></div><div className="button-row"><button className="primary-button" disabled={running} onClick={onStart}>{t("仅扫描视频")}</button><button disabled={scan?.status !== "running"} onClick={onCancel}>{t("取消")}</button></div></div>
    <code className="path-block">{roots.length ? roots.join("\n") : t("尚未配置可扫描资料根目录")}</code>
    {scan ? <div className={`progress ${scan.status}`}><strong>{scan.status} · {scan.progress.phase}</strong><span>{scan.progress.message}</span><span>{scan.progress.current} / {scan.progress.total}</span></div> : null}
    {scan?.result ? <><div className="mini-stat-grid">
      <MiniStat label={t("扫描目录")} value={scan.result.roots.length} /><MiniStat label={t("已发现")} value={scan.result.discovered} /><MiniStat label={t("新增")} value={scan.result.added} /><MiniStat label={t("已更新")} value={scan.result.updated} /><MiniStat label={t("未变化")} value={scan.result.unchanged} /><MiniStat label={t("已移除")} value={scan.result.removed} />
    </div><details className="scan-root-report"><summary>{t("本轮实际扫描的 {count} 个目录", { count: scan.result.roots.length })}</summary><code className="path-block">{scan.result.roots.join("\n")}</code></details>{scan.result.warnings.length ? <details><summary>{t("{count} 条媒体扫描警告", { count: scan.result.warnings.length })}</summary><ul>{scan.result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}</> : null}
  </section>;
}

/** 历史区只解释已落盘 Receipt，不参与任务轮询或扫描写入。 */
export function MediaScanHistorySection({ entries }: { entries: MediaScanHistoryEntry[] }) {
  const { t } = useDesktopI18n();
  return <details className="settings-card scan-history-card">
    <summary><span><span className="eyebrow">SCAN HISTORY · PRIVATE DIAGNOSTICS</span><strong>{t("扫描历史")}</strong></span><small>{t("最近 {count} 次", { count: entries.length })}</small></summary>
    {entries.length ? <div className="scan-history-list">{entries.map((entry) => {
      const { snapshot } = entry;
      const result = snapshot.result;
      return <article key={entry.id}>
        <div><strong>{formatDateTime(entry.recordedAt)} · {scanStatusLabel(snapshot.status, t)}</strong><small>{t("耗时 {duration}", { duration: formatElapsed(entry.durationMs) })}</small></div>
        <div className="desktop-dense-chips">
          <span>{t("已发现")} {result?.discovered ?? "—"}</span><span>{t("新增")} {result?.added ?? "—"}</span><span>{t("已更新")} {result?.updated ?? "—"}</span><span>{t("未变化")} {result?.unchanged ?? "—"}</span><span>{t("未绑定")} {result?.unmatched ?? "—"}</span>
        </div>
        {snapshot.error ? <p className="desktop-presentation-warning">{snapshot.error}</p> : null}
        {result?.warnings.length ? <details><summary>{t("{count} 条媒体扫描警告", { count: result.warnings.length })}</summary><ul>{result.warnings.slice(0, 50).map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
      </article>;
    })}</div> : <p className="muted">{t("还没有扫描历史；完成一次视频扫描后会自动记录。")}</p>}
  </details>;
}

export function MediaProbeSection({ selectedPath, probing, progress, probe, onChoose, onOpen, onReveal }: { selectedPath: string; probing: boolean; progress: DesktopTaskProgress | null; probe: DesktopMediaProbeResult | null; onChoose: () => void; onOpen: () => void; onReveal: () => void }) {
  const { t } = useDesktopI18n();
  return <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">NATIVE PROBE</span><h2>{t("单文件检查")}</h2></div><button onClick={onChoose} disabled={probing}>{t("选择 MP4 / MKV…")}</button></div>{selectedPath ? <code className="path-block">{selectedPath}</code> : <p className="muted">{t("可选择任意受支持视频验证 ffprobe、打开与定位能力。")}</p>}<div className="button-row"><button disabled={!selectedPath} onClick={onOpen}>{t("默认播放器打开")}</button><button disabled={!selectedPath} onClick={onReveal}>{t("资源管理器中定位")}</button></div>{progress ? <div className={`progress ${progress.stage}`}><strong>{progress.stage}</strong><span>{progress.message}</span></div> : null}{probe ? <div className="detail-grid compact-grid"><InfoCard label={t("时长")} value={formatDuration(probe.durationSeconds)} /><InfoCard label={t("分辨率")} value={probe.width && probe.height ? `${probe.width} × ${probe.height}` : undefined} /><InfoCard label={t("视频编码")} value={probe.videoCodec} /><InfoCard label={t("音频编码")} value={probe.audioCodec} /><InfoCard label={t("封装格式")} value={probe.container} /></div> : null}</section>;
}

function MiniStat({ label, value }: { label: string; value: number }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function formatDuration(value?: number): string | undefined { if (!value || !Number.isFinite(value)) return undefined; const total = Math.round(value); const hours = Math.floor(total / 3600); const minutes = Math.floor((total % 3600) / 60); const seconds = total % 60; return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`; }
function formatElapsed(milliseconds: number): string { const seconds = Math.round(milliseconds / 1000); if (seconds < 60) return `${seconds}s`; const minutes = Math.floor(seconds / 60); return `${minutes}m ${seconds % 60}s`; }
function formatDateTime(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }
function scanStatusLabel(status: MediaScanJobSnapshot["status"], t: (source: string) => string): string { switch (status) { case "completed": return t("已完成"); case "cancelled": return t("已取消"); case "failed": return t("失败"); case "running": return t("运行中"); case "cancelling": return t("正在取消"); } }
