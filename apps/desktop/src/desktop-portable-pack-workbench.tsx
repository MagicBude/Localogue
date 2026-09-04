import { useState } from "react";

import type { DesktopSharedPackInfo } from "./contracts";
import { useDesktopI18n } from "./desktop-i18n";
import {
  exportDesktopPersonalPack,
  exportDesktopSharedPack,
  importDesktopPortablePreview,
  pickAndPreviewPortablePack,
  type DesktopPortablePreview,
} from "./desktop-portable-pack";

export function DesktopPortablePackWorkbench({
  privateLibraryPath,
  packInfos,
  onSharedInstalled,
  onPrivateImported,
  setMessage,
}: {
  privateLibraryPath?: string;
  packInfos: DesktopSharedPackInfo[];
  onSharedInstalled: (path: string) => Promise<void>;
  onPrivateImported: () => void;
  setMessage: (message: string) => void;
}) {
  const { t } = useDesktopI18n();
  const [preview, setPreview] = useState<DesktopPortablePreview | null>(null);
  const [busy, setBusy] = useState(false);

  async function exportPersonal(): Promise<void> {
    if (!privateLibraryPath) { setMessage("请先配置 Private Library。 "); return; }
    setBusy(true);
    try {
      const path = await exportDesktopPersonalPack();
      if (path) setMessage(`Personal Pack 已导出：${path}`);
    } catch (error) { setMessage(`导出 Personal Pack 失败：${message(error)}`); }
    finally { setBusy(false); }
  }

  async function chooseImport(): Promise<void> {
    setBusy(true);
    try {
      const next = await pickAndPreviewPortablePack();
      setPreview(next);
      if (next) setMessage(next.importable ? `Portable Pack 预览完成：${next.fileCount} 个文件。` : `Portable Pack 有 ${next.errors.length} 个阻塞问题。`);
    } catch (error) { setPreview(null); setMessage(`读取 Portable Pack 失败：${message(error)}`); }
    finally { setBusy(false); }
  }

  async function applyImport(): Promise<void> {
    if (!preview?.importable) return;
    setBusy(true);
    try {
      const result = await importDesktopPortablePreview(preview);
      if (result.kind === "shared-library" && result.sharedPackPath) await onSharedInstalled(result.sharedPackPath);
      if (result.kind === "personal-backup") onPrivateImported();
      setMessage(`Portable Pack 导入完成：导入 ${result.imported}，跳过 ${result.skipped}。`);
      setPreview(null);
    } catch (error) { setMessage(`导入 Portable Pack 失败：${message(error)}`); }
    finally { setBusy(false); }
  }

  return <section className="settings-card portable-pack-card">
    <div className="section-heading">
      <div><span className="eyebrow">PORTABLE PACK</span><h2>{t("便携包导入 / 导出")}</h2><p className="muted">{t("Personal Backup 与 Shared Library Archive 使用同一个 `.localogue-pack` gzip JSON Envelope。导入先预览并校验 SHA-256，再显式执行。")}</p></div>
      <div className="button-row"><button disabled={busy || !privateLibraryPath} onClick={() => void exportPersonal()}>{t("导出 Personal Backup")}</button><button disabled={busy} onClick={() => void chooseImport()}>{t("导入 .localogue-pack…")}</button></div>
    </div>

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
      {preview.errors.length ? <ul className="governance-blockers">{preview.errors.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      {preview.warnings.length ? <ul>{preview.warnings.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      <button className="primary-button" disabled={busy || !preview.importable} onClick={() => void applyImport()}>{t("确认导入")}</button>
    </div> : null}
  </section>;

  async function exportShared(item: DesktopSharedPackInfo): Promise<void> {
    if (!item.id || !item.version) return;
    setBusy(true);
    try {
      const path = await exportDesktopSharedPack({ configuredPath: item.configuredPath, id: item.id, name: item.name ?? item.id, version: item.version });
      if (path) setMessage(`Shared Portable Archive 已导出：${path}`);
    } catch (error) { setMessage(`导出 Shared Portable Archive 失败：${message(error)}`); }
    finally { setBusy(false); }
  }
}

function PortableMetric({ label, value }: { label: string; value: string }) { return <div className="governance-metric"><span>{label}</span><strong className="portable-metric-value">{value}</strong></div>; }
function formatBytes(value: number): string { if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`; return `${(value / 1024 ** 2).toFixed(1)} MiB`; }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
