import { useState } from "react";

import type { DesktopAssetStorageHealth } from "./contracts";
import { useDesktopI18n } from "./desktop-i18n";
import { desktopBridge } from "./tauri-bridge";

const ASSET_STORAGE_NATIVE_CONTRACT_REVISION = 4;

export function DesktopAssetStorageGovernance({
  hasPrivateLibrary,
  runtimeContractRevision,
  setMessage,
}: {
  hasPrivateLibrary: boolean;
  runtimeContractRevision: number;
  setMessage: (message: string) => void;
}) {
  const { t } = useDesktopI18n();
  const [health, setHealth] = useState<DesktopAssetStorageHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const nativeReady = runtimeContractRevision >= ASSET_STORAGE_NATIVE_CONTRACT_REVISION;

  async function inspect(): Promise<void> {
    if (!hasPrivateLibrary) {
      setMessage(t("请先在设置页选择 Private Library。"));
      return;
    }
    if (!nativeReady) {
      setMessage(t("资源文件健康需要新版 Native Runtime；请完全退出并重新启动 Desktop。"));
      return;
    }
    setBusy(true);
    try {
      const next = await desktopBridge.inspectPrivateAssetStorage();
      setHealth(next);
      if (next.orphanFiles.length) {
        setMessage(t("发现 {count} 个孤儿文件，可回收 {bytes}。", { count: next.orphanFiles.length, bytes: formatBytes(next.reclaimableBytes) }));
      } else {
        setMessage(t("没有发现孤儿文件。"));
      }
    } catch (error) {
      setMessage(t("存储检查失败：{error}", { error: message(error) }));
    } finally {
      setBusy(false);
    }
  }

  async function cleanup(): Promise<void> {
    if (!health?.orphanFiles.length || !nativeReady) return;
    const confirmed = window.confirm(t(
      "清理 {count} 个孤儿文件并回收 {bytes}？\n\n只删除当前 Private Library/asset-files 中没有任何 Asset JSON 引用的普通文件。",
      { count: health.orphanFiles.length, bytes: formatBytes(health.reclaimableBytes) },
    ));
    if (!confirmed) return;

    setBusy(true);
    try {
      const result = await desktopBridge.cleanupPrivateAssetOrphans();
      setMessage(t("孤儿文件清理完成：删除 {count} 个文件，回收 {bytes}。", { count: result.deletedFiles, bytes: formatBytes(result.reclaimedBytes) }));
      setHealth(await desktopBridge.inspectPrivateAssetStorage());
    } catch (error) {
      setMessage(t("清理孤儿文件失败：{error}", { error: message(error) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-card desktop-asset-storage-governance">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ASSET STORAGE HEALTH</span>
          <h2>{t("资源文件健康")}</h2>
          <p className="muted">{t("检查 Private Library 的 asset-files 与 Asset JSON 是否一致；只清理没有任何 Asset 元数据引用的孤儿文件。")}</p>
        </div>
        <div className="button-row">
          <button disabled={busy || !hasPrivateLibrary || !nativeReady} onClick={() => void inspect()} type="button">{busy ? t("处理中…") : t("检查存储")}</button>
          <button className="danger-button" disabled={busy || !nativeReady || !health?.orphanFiles.length} onClick={() => void cleanup()} type="button">{t("清理孤儿文件")}</button>
        </div>
      </div>

      {health ? (
        <>
          <div className="mini-stat-grid desktop-asset-storage-stats">
            <StorageStat label={t("Asset 元数据")} value={health.assetRecords} />
            <StorageStat label={t("托管引用")} value={health.managedReferences} />
            <StorageStat label={t("磁盘文件")} value={health.storedFiles} />
            <StorageStat label={t("孤儿文件")} value={health.orphanFiles.length} />
            <StorageStat label={t("缺失文件")} value={health.missingFiles.length} />
            <StorageStat label={t("可回收")} value={formatBytes(health.reclaimableBytes)} />
          </div>

          {health.orphanFiles.length ? (
            <details className="desktop-asset-storage-details">
              <summary>{t("查看孤儿文件")} · {health.orphanFiles.length}</summary>
              <div className="desktop-asset-storage-file-list">
                {health.orphanFiles.map((file) => <code key={file.storagePath}>{file.storagePath} · {formatBytes(file.fileSize)}</code>)}
              </div>
            </details>
          ) : <p className="success-message">{t("没有发现孤儿文件。")}</p>}

          {health.missingFiles.length ? (
            <details className="desktop-asset-storage-details is-warning">
              <summary>{t("发现 {count} 个 Asset 引用的文件缺失；清理不会修改这些元数据。", { count: health.missingFiles.length })}</summary>
              <div className="desktop-asset-storage-file-list">{health.missingFiles.map((file) => <code key={file}>{file}</code>)}</div>
            </details>
          ) : null}

          {health.unmanagedReferences.length ? (
            <p className="muted">{t("有 {count} 个 Asset 使用非 asset-files 路径；为安全起见不纳入自动清理。", { count: health.unmanagedReferences.length })}</p>
          ) : null}
        </>
      ) : <p className="muted">{nativeReady ? t("尚未检查 Private Asset 文件存储。") : t("资源文件健康需要新版 Native Runtime；请完全退出并重新启动 Desktop。")}</p>}
    </section>
  );
}

function StorageStat({ label, value }: { label: string; value: string | number }) {
  return <div className="mini-stat"><span>{label}</span><strong>{value}</strong></div>;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / (1024 ** index);
  return `${amount >= 100 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
