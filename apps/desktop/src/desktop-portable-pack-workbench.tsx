import { useState } from "react";

import type { DesktopSharedPackInfo } from "./contracts";
import { useDesktopI18n } from "./desktop-i18n";
import {
  exportDesktopPersonalPack,
  exportDesktopSharedPack,
  importDesktopPortablePreview,
  pickAndPreviewPortablePack,
  type DesktopPortableImportReport,
  type DesktopPortablePreview,
} from "./desktop-portable-pack";

const PORTABLE_NATIVE_CONTRACT_REVISION = 6;

export function DesktopPortablePackWorkbench({
  privateLibraryPath,
  profileName,
  runtimeContractRevision,
  packInfos,
  onSharedInstalled,
  onPrivateImported,
  setMessage,
}: {
  privateLibraryPath?: string;
  profileName?: string;
  runtimeContractRevision: number;
  packInfos: DesktopSharedPackInfo[];
  onSharedInstalled: (path: string) => Promise<void>;
  onPrivateImported: () => void;
  setMessage: (message: string) => void;
}) {
  const { t } = useDesktopI18n();
  const [preview, setPreview] = useState<DesktopPortablePreview | null>(null);
  const [result, setResult] = useState<DesktopPortableImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const nativeReady = runtimeContractRevision >= PORTABLE_NATIVE_CONTRACT_REVISION;
  const previewTargetChanged = Boolean(
    preview?.manifest.kind === "personal-backup"
    && preview.personalPlan?.targetLibraryPath
    && (!privateLibraryPath || !sameLibraryPath(preview.personalPlan.targetLibraryPath, privateLibraryPath)),
  );

  async function exportPersonal(): Promise<void> {
    if (!privateLibraryPath) { setMessage(t("请先配置 Private Library。")); return; }
    setBusy(true);
    try {
      const path = await exportDesktopPersonalPack();
      if (path) setMessage(t("当前资料库 Personal Backup 已导出：{path}", { path }));
    } catch (error) { setMessage(t("导出 Personal Pack 失败：{error}", { error: message(error) })); }
    finally { setBusy(false); }
  }

  async function chooseImport(): Promise<void> {
    setBusy(true);
    try {
      const next = await pickAndPreviewPortablePack();
      setPreview(next);
      setResult(null);
      if (next) setMessage(next.importable
        ? t("Portable Pack 预览完成：{count} 个文件。", { count: next.fileCount })
        : t("Portable Pack 有 {count} 个阻塞问题。", { count: next.errors.length }));
    } catch (error) { setPreview(null); setResult(null); setMessage(t("读取 Portable Pack 失败：{error}", { error: message(error) })); }
    finally { setBusy(false); }
  }

  async function applyImport(): Promise<void> {
    if (!preview?.importable || previewTargetChanged) return;
    setBusy(true);
    try {
      const next = await importDesktopPortablePreview(preview);
      if (next.kind === "shared-library" && next.sharedPackPath) await onSharedInstalled(next.sharedPackPath);
      if (next.kind === "personal-backup") onPrivateImported();
      setResult(next);
      setMessage(t("Portable Pack 导入完成：导入 {imported}，跳过 {skipped}。", { imported: next.imported, skipped: next.skipped }));
      setPreview(null);
    } catch (error) { setMessage(t("导入 Portable Pack 失败：{error}", { error: message(error) })); }
    finally { setBusy(false); }
  }

  return <section className="settings-card portable-pack-card">
    <div className="section-heading">
      <div>
        <span className="eyebrow">PORTABLE PACK · V1-24C</span>
        <h2>{t("便携包导入 / 导出")}</h2>
        <p className="muted">{t("Personal Backup 只备份当前资料库的 Private Canonical、Audit、Presentation 与 Asset；不会携带 Profile 路径、媒体文件路径或实例设置。导入前会区分新增、相同与冲突文件。")}</p>
        {profileName ? <p className="portable-profile-note"><b>{t("当前资料库")}</b> · {profileName}{privateLibraryPath ? <> · <code>{privateLibraryPath}</code></> : null}</p> : null}
      </div>
      <div className="button-row"><button disabled={busy || !privateLibraryPath} onClick={() => void exportPersonal()}>{t("导出当前资料库备份")}</button><button disabled={busy || !nativeReady} onClick={() => void chooseImport()}>{t("导入 .localogue-pack…")}</button></div>
    </div>

    {!nativeReady ? <p className="desktop-presentation-warning">{t("Portable Pack 冲突预览需要新版 Native Runtime；请完全退出并重新启动 Desktop。")}</p> : null}

    {packInfos.some((item) => item.valid) ? <div className="portable-shared-export-list">
      {packInfos.filter((item) => item.valid && item.id && item.version).map((item) => <div key={item.configuredPath}><span><b>{item.name ?? item.id}</b><small>{item.id} · {item.version}</small></span><button disabled={busy} onClick={() => void exportShared(item)}>{t("导出 Shared Archive")}</button></div>)}
    </div> : null}

    {preview ? <div className="portable-preview">
      <div className="governance-metrics">
        <PortableMetric label={t("类型")} value={preview.manifest.kind} />
        <PortableMetric label={t("文件")} value={String(preview.fileCount)} />
        <PortableMetric label={t("大小")} value={formatBytes(preview.totalBytes)} />
        <PortableMetric label={t("状态")} value={preview.importable ? t("可导入") : t("已阻塞")} />
      </div>
      <strong>{preview.manifest.name}</strong><code>{preview.path}</code>

      {preview.personalPlan ? <>
        <div className="portable-import-target">
          <span>{t("导入目标")}</span>
          <strong>{profileName ?? t("当前资料库")}</strong>
          <code>{preview.personalPlan.targetLibraryPath}</code>
        </div>
        {previewTargetChanged ? <p className="desktop-presentation-warning">{t("当前资料库已经切换。为了避免把备份导入错误的资料库，请重新选择 Portable Pack 生成新的导入预览。")}</p> : null}
        <div className="governance-metrics portable-plan-metrics">
          <PortableMetric label={t("新增")} value={String(preview.personalPlan.newFiles)} />
          <PortableMetric label={t("完全相同")} value={String(preview.personalPlan.identicalFiles)} />
          <PortableMetric label={t("内容冲突")} value={String(preview.personalPlan.conflictFiles)} />
          <PortableMetric label={t("展示偏好")} value={String(preview.assetIntegrity?.presentationPreferences ?? 0)} />
          <PortableMetric label={t("Asset 文件")} value={String(preview.assetIntegrity?.assetFiles ?? 0)} />
        </div>
        <div className="portable-category-grid">
          {Object.entries(preview.personalPlan.categories).map(([category, counts]) => <div key={category}><strong>{categoryLabel(category, t)}</strong><small>{t("新增 {newCount} · 相同 {sameCount} · 冲突 {conflictCount}", { newCount: counts.newFiles, sameCount: counts.identicalFiles, conflictCount: counts.conflictFiles })}</small></div>)}
        </div>
        {preview.personalPlan.conflictFiles ? <details className="portable-detail-list" open><summary>{t("查看冲突文件 · {count}", { count: preview.personalPlan.conflictFiles })}</summary>{preview.personalPlan.entries.filter((entry) => entry.status === "conflict").slice(0, 50).map((entry) => <code key={entry.path}>{entry.path}</code>)}</details> : null}
      </> : null}

      {preview.errors.length ? <ul className="governance-blockers">{preview.errors.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      {preview.warnings.length ? <ul>{preview.warnings.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      <div className="button-row">
        <button className="primary-button" disabled={busy || !preview.importable || previewTargetChanged} onClick={() => void applyImport()}>{t("确认导入")}</button>
        <button disabled={busy} onClick={() => { setPreview(null); setResult(null); }}>{t("放弃预览")}</button>
      </div>
    </div> : null}

    {result ? <div className="portable-preview portable-import-result">
      <div className="section-heading"><div><span className="eyebrow">IMPORT RESULT</span><h3>{t("导入结果")}</h3></div></div>
      <div className="governance-metrics">
        <PortableMetric label={t("已导入")} value={String(result.imported)} />
        <PortableMetric label={t("已跳过")} value={String(result.skipped)} />
        {result.kind === "personal-backup" ? <>
          <PortableMetric label={t("相同跳过")} value={String(result.skippedIdentical ?? 0)} />
          <PortableMetric label={t("冲突跳过")} value={String(result.skippedConflicts ?? 0)} />
          <PortableMetric label={t("导入后缺失 Asset 文件")} value={String(result.assetStorageAfterImport?.missingFiles.length ?? 0)} />
        </> : null}
      </div>
      {result.importedByCategory ? <div className="portable-category-grid">{Object.keys({ ...result.importedByCategory, ...result.skippedByCategory }).sort().map((category) => <div key={category}><strong>{categoryLabel(category, t)}</strong><small>{t("导入 {imported} · 跳过 {skipped}", { imported: result.importedByCategory?.[category] ?? 0, skipped: result.skippedByCategory?.[category] ?? 0 })}</small></div>)}</div> : null}
      {result.warnings.length ? <ul>{result.warnings.map((item) => <li key={item}>{item}</li>)}</ul> : null}
    </div> : null}
  </section>;

  async function exportShared(item: DesktopSharedPackInfo): Promise<void> {
    if (!item.id || !item.version) return;
    setBusy(true);
    try {
      const path = await exportDesktopSharedPack({ configuredPath: item.configuredPath, id: item.id, name: item.name ?? item.id, version: item.version });
      if (path) setMessage(t("Shared Portable Archive 已导出：{path}", { path }));
    } catch (error) { setMessage(t("导出 Shared Portable Archive 失败：{error}", { error: message(error) })); }
    finally { setBusy(false); }
  }
}

function PortableMetric({ label, value }: { label: string; value: string }) { return <div className="governance-metric"><span>{label}</span><strong className="portable-metric-value">{value}</strong></div>; }
function formatBytes(value: number): string { if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`; return `${(value / 1024 ** 2).toFixed(1)} MiB`; }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function categoryLabel(category: string, t: (key: string, values?: Record<string, string | number>) => string): string {
  const labels: Record<string, string> = {
    canonical: t("Canonical 元数据"),
    assetMetadata: t("Asset 元数据"),
    assetFiles: t("Asset 文件"),
    presentation: t("展示偏好"),
    audit: t("Audit / History"),
  };
  return labels[category] ?? category;
}

function sameLibraryPath(left: string, right: string): boolean {
  const normalize = (value: string) => value.trim().replaceAll("\\", "/").replace(/\/+$/, "").toLocaleLowerCase();
  return normalize(left) === normalize(right);
}
