import type { Dispatch, SetStateAction } from "react";

import type { DesktopBootstrapSettings, DesktopSharedPackInfo } from "./contracts";
import { useDesktopI18n } from "./desktop-i18n";
import { DesktopPortablePackWorkbench } from "./desktop-portable-pack-workbench";
import { TauriFileDialogAdapter } from "./platform/tauri-platform-adapters";
import { desktopBridge } from "./tauri-bridge";

const fileDialog = new TauriFileDialogAdapter();

/**
 * 资料包页面只管理 Shared Pack 的配置草稿、优先级和 Portable Pack 工作台。
 * Native 校验与安装仍由 Bridge / Workbench 负责，页面不接触实际文件写入。
 */
export function DesktopPacksPage({
  settings,
  setSettings,
  privateLibraryPath,
  profileName,
  runtimeContractRevision,
  packInfos,
  busy,
  onSave,
  setMessage,
  onOpenSettings,
  onSharedInstalled,
  onPrivateImported,
}: {
  settings: DesktopBootstrapSettings;
  setSettings: Dispatch<SetStateAction<DesktopBootstrapSettings>>;
  privateLibraryPath?: string;
  profileName?: string;
  runtimeContractRevision: number;
  packInfos: DesktopSharedPackInfo[];
  busy: boolean;
  onSave: () => Promise<void>;
  setMessage: (message: string) => void;
  onOpenSettings: () => void;
  onSharedInstalled: (path: string) => Promise<void>;
  onPrivateImported: () => void;
}) {
  const { t } = useDesktopI18n();

  async function addPack(): Promise<void> {
    const path = await fileDialog.pickDirectory();
    if (!path) return;
    try {
      const inspected = await desktopBridge.inspectSharedPack(path);
      if (!inspected.valid) throw new Error(inspected.error ?? t("Shared Pack 校验失败。"));
      setSettings((current) => ({ ...current, sharedPackPaths: unique([...current.sharedPackPaths, path]) }));
      setMessage(t("已加入 Shared Pack 草稿：{name}。点击“保存资料包配置”后生效。", { name: inspected.name ?? path }));
    } catch (error) {
      setMessage(t("无法挂载 Shared Pack：{error}", { error: toMessage(error) }));
    }
  }

  function movePack(index: number, direction: -1 | 1): void {
    setSettings((current) => {
      const next = [...current.sharedPackPaths];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, sharedPackPaths: next };
    });
  }

  function removePack(path: string): void {
    setSettings((current) => ({ ...current, sharedPackPaths: current.sharedPackPaths.filter((item) => item !== path) }));
  }

  const hasDraftChanges = JSON.stringify(settings.sharedPackPaths) !== JSON.stringify(packInfos.map((item) => item.configuredPath));

  return (
    <div className="page-stack">
      <section className="page-title"><span className="eyebrow">SHARED · PRIVATE · PRIORITY</span><h1>{t("资料包")}</h1><p>{t("Shared Pack 在 Desktop 中支持挂载、Native 校验、优先级调整和卸载；内容仍由 Rust Boundary 强制只读。")}</p></section>
      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">SOURCE PRIORITY</span><h2>{t("当前资料源优先级")}</h2><p className="muted">{t("Private 永远最高；Shared Pack 顺序决定相同稳定 ID 的读取优先级。")}</p></div><div className="button-row"><button onClick={() => void addPack()}>{t("+ 挂载 Shared Pack")}</button><button className="primary-button" disabled={busy || !hasDraftChanges} onClick={() => void onSave()}>{busy ? t("保存中…") : t("保存资料包配置")}</button></div></div>
        <ol className="source-priority-list">
          {privateLibraryPath ? <li><span className="source-index">1</span><div><strong>Private Library</strong><code>{privateLibraryPath}</code></div><span className="status-chip ok">WRITABLE</span></li> : null}
          {settings.sharedPackPaths.map((path, index) => {
            const pack = packInfos.find((item) => item.configuredPath === path);
            return <li key={path}><span className="source-index">{index + (privateLibraryPath ? 2 : 1)}</span><div><strong>{pack?.name ?? path}</strong><code>{pack?.libraryPath ?? path}</code><small>{pack ? (pack.valid ? `${pack.id} · ${pack.version}${pack.license ? ` · ${pack.license}` : ""}` : pack.error) : t("尚未保存 / 重新校验")}</small></div><div className="pack-actions"><button disabled={index === 0} onClick={() => movePack(index, -1)}>↑</button><button disabled={index === settings.sharedPackPaths.length - 1} onClick={() => movePack(index, 1)}>↓</button><button className="danger-button" onClick={() => removePack(path)}>{t("卸载")}</button></div></li>;
          })}
        </ol>
        {!privateLibraryPath && !settings.sharedPackPaths.length ? <p className="muted">{t("当前没有配置资料源。")} </p> : null}
        {hasDraftChanges ? <p className="status-chip warn">{t("存在未保存的 Shared Pack 变更")}</p> : <p className="status-chip ok">{t("Shared Pack 配置已保存")}</p>}
      </section>
      <DesktopPortablePackWorkbench privateLibraryPath={privateLibraryPath} profileName={profileName} runtimeContractRevision={runtimeContractRevision} packInfos={packInfos} onSharedInstalled={onSharedInstalled} onPrivateImported={onPrivateImported} setMessage={setMessage} />
      <section className="settings-card soft-card"><span className="eyebrow">NATIVE READ-ONLY BOUNDARY</span><h2>{t("Shared Pack 不会被 Desktop CRUD 修改")}</h2><p>{t("编辑 Shared Work / Person 时，Desktop 会在 Private Library 写入同 ID Override；删除也只删除 Private Override。Shared Pack 本身不会通过 Canonical Writer 被修改。")}</p><button onClick={onOpenSettings}>{t("打开完整实例设置")}</button></section>
    </div>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
