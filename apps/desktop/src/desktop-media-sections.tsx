import type { ReactNode } from "react";

import { localizeText } from "@/application/services/localization-service";
import { findApprovedGenreAlias } from "@/application/services/genre-localization-service";
import type { MediaFile } from "@/domain/entities/media-file";
import type { MediaScanJobSnapshot } from "@/domain/entities/media-scan";
import type { Work } from "@/domain/entities/work";

import { useDesktopI18n } from "./desktop-i18n";
import type { DesktopMediaProbeResult, DesktopTaskProgress } from "./contracts";
import type { LocalAssetImportPreview, LocalAssetImportResult } from "./local-asset-import";
import type { NfoImportItemStatus, NfoImportPreview, NfoImportResult } from "./nfo-library-import";
import type { VocabularyRepairPreview, VocabularyRepairResult } from "./vocabulary-repair";

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

/** 导入预览只呈现候选和结果；Preview / Evidence / Import 的执行顺序仍由父页面控制。 */
export function MetadataImportSection({ roots, busy, nfoPreview, assetPreview, nfoResult, assetResult, onPreview, onSaveEvidence, onImport }: {
  roots: string[]; busy: boolean; nfoPreview: NfoImportPreview | null; assetPreview: LocalAssetImportPreview | null;
  nfoResult: NfoImportResult | null; assetResult: LocalAssetImportResult | null;
  onPreview: () => void; onSaveEvidence: () => void; onImport: () => void;
}) {
  const { t } = useDesktopI18n();
  return <section className="settings-card table-card">
    <div className="section-heading"><div><span className="eyebrow">UNIFIED METADATA SOURCE</span><h2>{t("NFO + 本地图片")}</h2><p className="muted">{t("推荐只配置一个大目录。Desktop 会递归发现子目录中的 NFO、poster、fanart、thumb，再按番号或同 stem 汇聚到同一个 Work；原始图片不会移动。")}</p></div><div className="button-row"><button disabled={busy} onClick={onPreview}>{busy ? t("处理中…") : t("预览 NFO + 图片")}</button><button disabled={busy || !nfoPreview?.importable} onClick={onSaveEvidence}>保存为 Evidence</button><button className="primary-button" disabled={busy || !(nfoPreview?.importable || assetPreview?.linkable)} onClick={onImport}>{t("导入当前预览")}</button></div></div>
    <code className="path-block">{roots.length ? roots.join("\n") : t("尚未配置 Unified Library Root / 兼容扫描路径")}</code>
    {nfoPreview ? <><SectionTitle eyebrow="NFO GROUPS" title={t("NFO 作品组")} /><div className="mini-stat-grid"><MiniStat label={t("NFO 文件")} value={nfoPreview.discovered} /><MiniStat label={t("Work 候选")} value={nfoPreview.importable} /><MiniStat label={t("新 Work")} value={nfoPreview.newWorks} /><MiniStat label={t("已有 Work")} value={nfoPreview.existingWorks} /><MiniStat label={t("跳过文件")} value={nfoPreview.skipped + nfoPreview.errors} /></div>
      <div className="table-wrap nfo-preview-table"><table className="data-table"><thead><tr><th>{t("作品组 / NFO 来源")}</th><th>{t("番号")}</th><th>{t("标题")}</th><th>{t("状态")}</th></tr></thead><tbody>{nfoPreview.groups.slice(0, 100).map((group) => <tr key={group.key}><td><strong>{group.sourceCount > 1 ? t("{count} 个 NFO 来源", { count: group.sourceCount }) : group.representative.fileName}</strong>{group.sourceCount > 1 ? <details><summary>{t("查看文件")}</summary><small className="path-text">{group.sources.map((item) => item.fileName).join("\n")}</small></details> : <small className="path-text">{group.representative.path}</small>}</td><td>{group.code ?? "—"}</td><td>{group.title ?? group.representative.error ?? "—"}{group.representative.unmappedTerms?.length ? <small className="path-text">{t("Unmapped 来源词")}: {group.representative.unmappedTerms.length}</small> : null}</td><td><span className={nfoStatusClass(group.status)}>{nfoStatusLabel(group.status, t)}{group.sourceCount > 1 ? ` · ${t("{count} 个 NFO 来源", { count: group.sourceCount })}` : ""}</span></td></tr>)}</tbody></table></div>{nfoPreview.groups.length > 100 ? <p className="muted">{t("NFO 预览只显示前 100 个作品组；导入会处理全部 {count} 个可识别 Work 候选。", { count: nfoPreview.importable })}</p> : null}</> : <p className="muted">{t("多段 NFO（例如 MDVR-195.part1～part6）会聚合成一个 Work 组，不再把其余文件显示成一长串“重复番号”。")}</p>}
    {assetPreview ? <><SectionTitle eyebrow="LOCAL ASSET CANDIDATES" title={t("本地图片资产")} /><div className="mini-stat-grid"><MiniStat label={t("图片")} value={assetPreview.discovered} /><MiniStat label={t("可关联")} value={assetPreview.linkable} /><MiniStat label={t("等待 Work")} value={assetPreview.pendingWork} /><MiniStat label={t("跳过")} value={assetPreview.skipped} /></div><div className="table-wrap"><table className="data-table"><thead><tr><th>{t("图片")}</th><th>{t("番号")}</th><th>{t("类型")}</th><th>{t("匹配")}</th><th>{t("状态")}</th></tr></thead><tbody>{assetPreview.items.slice(0, 100).map((item) => <tr key={item.path}><td><strong>{item.fileName}</strong><small className="path-text">{item.path}</small></td><td>{item.code ?? "—"}</td><td>{item.type ?? "—"}</td><td>{item.matchedBy === "nfo-stem" ? t("同 NFO stem") : item.matchedBy === "filename-code" ? t("文件名番号") : "—"}</td><td><span className={assetStatusClass(item.status)}>{assetStatusLabel(item.status, t)}</span></td></tr>)}</tbody></table></div>{assetPreview.items.length > 100 ? <p className="muted">{t("图片预览只显示前 100 条；实际导入会处理全部 {count} 张可关联图片。", { count: assetPreview.linkable })}</p> : null}</> : null}
    {nfoResult ? <p className="success-message">{t("NFO：导入 {imported} · 新建 Work {works} · 更新 {updated} · 新建 Person {people} · 新建 Organization {organizations}", { imported: nfoResult.imported, works: nfoResult.createdWorks, updated: nfoResult.updatedWorks, people: nfoResult.createdPeople, organizations: nfoResult.createdOrganizations })}</p> : null}{assetResult ? <p className="success-message">{t("图片：关联 {imported} · 新建 Asset {created} · 复用 {reused} · 更新 Work {works}", { imported: assetResult.imported, created: assetResult.createdAssets, reused: assetResult.reusedAssets, works: assetResult.updatedWorks })}</p> : null}
    {nfoResult?.warnings.length ? <details><summary>{t("{count} 条 NFO 导入警告", { count: nfoResult.warnings.length })}</summary><ul>{nfoResult.warnings.slice(0, 50).map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}{assetResult?.warnings.length ? <details><summary>{t("{count} 条 Asset 导入警告", { count: assetResult.warnings.length })}</summary><ul>{assetResult.warnings.slice(0, 50).map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
  </section>;
}

export function VocabularyAuditSection({ busy, preview, result, onPreview, onApply }: { busy: boolean; preview: VocabularyRepairPreview | null; result: VocabularyRepairResult | null; onPreview: () => void; onApply: () => void }) {
  const { t, metadataLanguage } = useDesktopI18n();
  return <section className="settings-card vocabulary-audit-card"><div className="section-heading"><div><span className="eyebrow">VOCABULARY AUDIT</span><h2>{t("分类词表审计")}</h2><p className="muted">{t("检查早期 NFO 导入把“系列: … / 单体作品 / イメージビデオ”等混入 Genre / Tag 的情况。先预览，再显式修复；用户手工 Tag 不会被删除。")}</p></div><div className="button-row"><button disabled={busy} onClick={onPreview}>{busy ? t("处理中…") : t("检查分类")}</button><button className="primary-button" disabled={busy || !preview?.affectedWorks} onClick={onApply}>{t("应用修复")}</button></div></div>
    {preview ? <><div className="mini-stat-grid"><MiniStat label={t("扫描 Work")} value={preview.scannedWorks} /><MiniStat label={t("需要修复")} value={preview.affectedWorks} /><MiniStat label={t("移入 Series")} value={preview.movedToSeries} /><MiniStat label={t("移入作品类型")} value={preview.movedToWorkTypes} /><MiniStat label={t("移入 Genre")} value={preview.movedToGenres} /><MiniStat label={t("Unmapped 来源词")} value={preview.unmappedTerms.length} /></div>{preview.unmappedTerms.length ? <details><summary>{t("查看 unmapped 来源词（不会自动进入 Canonical）")}</summary><div className="token-list vocabulary-unmapped-list">{preview.unmappedTerms.slice(0, 200).map((term) => { const reference = findApprovedGenreAlias(term); const localized = reference ? (metadataLanguage === "zh-CN" ? reference["zh-CN"] : metadataLanguage === "en" ? reference.en : reference.ja) : undefined; return <code key={term} title={reference ? `${reference.sources.join(" / ")} · ${reference.note ?? "approved genre alias"}` : undefined}>{localized && localized !== term ? `${term} → ${localized}` : term}{reference ? ` · ${t("词表参考")}` : ""}</code>; })}</div></details> : null}<p className="muted">{t("将移除 {genres} 个早期 NFO Genre 引用和 {tags} 个早期 NFO Tag 引用，再按映射表重新分流。", { genres: preview.removedImportedGenres, tags: preview.removedImportedTags })}</p></> : <p className="muted">{t("尚未执行分类审计。这个工具专门修复早期 Desktop NFO Bootstrap 产生的分类污染。")}</p>}{result ? <p className="success-message">{t("上次修复：更新 {works} 个 Work · 新建 Series {series} · 新建 Genre {genres}", { works: result.updatedWorks, series: result.createdSeries, genres: result.createdGenres })}</p> : null}
  </section>;
}

export function MediaProbeSection({ selectedPath, probing, progress, probe, onChoose, onOpen, onReveal }: { selectedPath: string; probing: boolean; progress: DesktopTaskProgress | null; probe: DesktopMediaProbeResult | null; onChoose: () => void; onOpen: () => void; onReveal: () => void }) {
  const { t } = useDesktopI18n();
  return <section className="settings-card"><div className="section-heading"><div><span className="eyebrow">NATIVE PROBE</span><h2>{t("单文件检查")}</h2></div><button onClick={onChoose} disabled={probing}>{t("选择 MP4 / MKV…")}</button></div>{selectedPath ? <code className="path-block">{selectedPath}</code> : <p className="muted">{t("可选择任意受支持视频验证 ffprobe、打开与定位能力。")}</p>}<div className="button-row"><button disabled={!selectedPath} onClick={onOpen}>{t("默认播放器打开")}</button><button disabled={!selectedPath} onClick={onReveal}>{t("资源管理器中定位")}</button></div>{progress ? <div className={`progress ${progress.stage}`}><strong>{progress.stage}</strong><span>{progress.message}</span></div> : null}{probe ? <div className="detail-grid compact-grid"><InfoCard label={t("时长")} value={formatDuration(probe.durationSeconds)} /><InfoCard label={t("分辨率")} value={probe.width && probe.height ? `${probe.width} × ${probe.height}` : undefined} /><InfoCard label={t("视频编码")} value={probe.videoCodec} /><InfoCard label={t("音频编码")} value={probe.audioCodec} /><InfoCard label={t("封装格式")} value={probe.container} /></div> : null}</section>;
}

function MiniStat({ label, value }: { label: string; value: number }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) { return <div className="section-title"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>; }
function InfoCard({ label, value }: { label: string; value?: string }) { return <article className="info-card"><span>{label}</span><strong>{value && value !== "—" ? value : "—"}</strong></article>; }
function formatDuration(value?: number): string | undefined { if (!value || !Number.isFinite(value)) return undefined; const total = Math.round(value); const hours = Math.floor(total / 3600); const minutes = Math.floor((total % 3600) / 60); const seconds = total % 60; return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`; }
function nfoStatusLabel(status: NfoImportItemStatus, t: (source: string, variables?: Record<string, string | number>) => string): string { switch (status) { case "new_work": return t("新 Work"); case "existing_work": return t("补充已有 Work"); case "missing_code": return t("缺少番号"); case "missing_title": return t("缺少标题"); case "duplicate_code": return t("重复番号"); case "parse_error": return t("解析失败"); } }
function nfoStatusClass(status: NfoImportItemStatus): string { return status === "new_work" || status === "existing_work" ? "status-chip ok" : "status-chip warn"; }
function assetStatusLabel(status: LocalAssetImportPreview["items"][number]["status"], t: (source: string) => string): string { switch (status) { case "ready": return t("可关联"); case "pending_work": return t("等待本轮 NFO 创建 Work"); case "missing_code": return t("缺少番号"); case "work_not_found": return t("找不到 Work"); case "unknown_asset_type": return t("未识别图片角色"); } }
function assetStatusClass(status: LocalAssetImportPreview["items"][number]["status"]): string { return status === "ready" || status === "pending_work" ? "status-chip ok" : "status-chip warn"; }
function mediaSummary(file: MediaFile): ReactNode { const resolution = file.width && file.height ? `${file.width}×${file.height}` : null; const codecs = [file.container, file.videoCodec, file.audioCodec].filter(Boolean).join(" · "); return <><strong>{resolution ?? "—"}</strong><small>{codecs || (file.analysisStale ? "analysis stale" : "—")}</small></>; }
function formatBytes(value: number): string { if (!value) return "0 B"; const units = ["B", "KB", "MB", "GB", "TB"]; const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / 1024 ** index).toFixed(index > 2 ? 2 : 1)} ${units[index]}`; }
function toMessage(error: unknown): string { return error instanceof Error ? error.message : String(error ?? "未知错误"); }
