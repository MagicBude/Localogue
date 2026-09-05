import type { ReactNode } from "react";

import { localizeText } from "@/application/services/localization-service";
import type { MediaFile } from "@/domain/entities/media-file";
import type { MediaScanJobSnapshot } from "@/domain/entities/media-scan";
import type { Work } from "@/domain/entities/work";

import { useDesktopI18n } from "./desktop-i18n";

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

export function MediaLibrarySection({ loading, error, media, works, assetCount, bindingMediaId, onOpen, onReveal, onToggleBinding }: {
  loading: boolean;
  error: unknown;
  media?: MediaFile[];
  works?: Map<string, Work>;
  assetCount?: number;
  bindingMediaId: string | null;
  onOpen: (path: string) => void;
  onReveal: (path: string) => void;
  onToggleBinding: (id: string) => void;
}) {
  const { t, metadataLanguage } = useDesktopI18n();
  if (loading) return <section className="empty-state"><div className="loading-dot" /><strong>{t("正在读取资料库…")}</strong></section>;
  if (error || !media || !works) return <section className="empty-state error-state"><span className="eyebrow">READ ERROR</span><h2>{t("无法读取当前页面")}</h2><p>{toMessage(error)}</p></section>;
  return <section className="settings-card table-card"><div className="section-heading"><div><span className="eyebrow">PRIVATE LOCAL DATA</span><h2>{media.length} {t("视频")} · {t("{count} 个资产", { count: assetCount ?? 0 })}</h2></div></div>
    {media.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>{t("文件")}</th><th>{t("作品")}</th><th>{t("大小")}</th><th>{t("媒体参数")}</th><th>{t("操作")}</th></tr></thead><tbody>{media.map((file) => { const work = file.workId ? works.get(file.workId) : undefined; return <tr key={file.id}><td><strong>{file.fileName}</strong><small className="path-text">{file.path}</small></td><td>{work ? <><strong>{work.code}</strong><small>{localizeText(work.titles, metadataLanguage)}</small></> : <span className="status-chip warn">{t("未绑定")}</span>}</td><td>{formatBytes(file.fileSize ?? 0)}</td><td>{mediaSummary(file)}</td><td><div className="row-actions"><button onClick={() => onOpen(file.path)}>{t("打开")}</button><button onClick={() => onReveal(file.path)}>{t("定位")}</button><button className={bindingMediaId === file.id ? "primary-button" : ""} onClick={() => onToggleBinding(file.id)}>{t("管理绑定")}</button></div></td></tr>; })}</tbody></table></div> : <p className="muted">{t("尚未扫描到本地媒体。")} </p>}
  </section>;
}

function MiniStat({ label, value }: { label: string; value: number }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function mediaSummary(file: MediaFile): ReactNode { const resolution = file.width && file.height ? `${file.width}×${file.height}` : null; const codecs = [file.container, file.videoCodec, file.audioCodec].filter(Boolean).join(" · "); return <><strong>{resolution ?? "—"}</strong><small>{codecs || (file.analysisStale ? "analysis stale" : "—")}</small></>; }
function formatBytes(value: number): string { if (!value) return "0 B"; const units = ["B", "KB", "MB", "GB", "TB"]; const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** index).toFixed(index > 2 ? 2 : 1)} ${units[index]}`; }
function toMessage(error: unknown): string { return error instanceof Error ? error.message : String(error ?? "未知错误"); }
