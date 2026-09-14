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
      if (!inspected.valid) throw new Error(inspected.error ?? t("社区资料包校验失败。"));
      setSettings((current) => ({ ...current, sharedPackPaths: unique([...current.sharedPackPaths, path]) }));
      setMessage(t("已加入社区资料包：{name}。点击“保存设置”后生效。", { name: inspected.name ?? path }));
    } catch (error) {
      setMessage(t("无法添加社区资料包：{error}", { error: toMessage(error) }));
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

  async function revealPrivateLibrary(): Promise<void> {
    if (!privateLibraryPath) return;
    try {
      await desktopBridge.revealInFolder(privateLibraryPath);
    } catch (error) {
      setMessage(t("无法打开数据存储位置：{error}", { error: toMessage(error) }));
    }
  }

  const hasDraftChanges = JSON.stringify(settings.sharedPackPaths) !== JSON.stringify(packInfos.map((item) => item.configuredPath));

  return (
    <div className="page-stack">
      <section className="page-title"><span className="eyebrow">COMMUNITY DATA · PERSONAL BACKUP</span><h1>{t("社区资料与个人备份")}</h1><p>{t("安装只读的社区资料，或备份当前影片库的个人数据；两者不会包含原始视频。")}</p></section>
      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">DISPLAY ORDER</span><h2>{t("资料显示顺序")}</h2><p className="muted">{t("当前影片库的个人资料优先；多个社区资料包按下列顺序补充内容。")}</p></div><div className="button-row"><button onClick={() => void addPack()}>{t("+ 添加社区资料包")}</button><button className="primary-button" disabled={busy || !hasDraftChanges} onClick={() => void onSave()}>{busy ? t("保存中…") : t("保存设置")}</button></div></div>
        <ol className="source-priority-list">
          {privateLibraryPath ? <li><span className="source-index">1</span><div><strong>{t("当前影片库的个人资料")}</strong><code>{privateLibraryPath}</code></div><div className="pack-actions"><span className="status-chip ok">{t("本机可写")}</span><button onClick={() => void revealPrivateLibrary()}>{t("打开位置")}</button></div></li> : null}
          {settings.sharedPackPaths.map((path, index) => {
            const pack = packInfos.find((item) => item.configuredPath === path);
            return <li key={path}><span className="source-index">{index + (privateLibraryPath ? 2 : 1)}</span><div><strong>{pack?.name ?? path}</strong><code>{pack?.libraryPath ?? path}</code><small>{pack ? (pack.valid ? `${pack.id} · ${pack.version}${pack.license ? ` · ${pack.license}` : ""}` : pack.error) : t("尚未保存 / 重新校验")}</small></div><div className="pack-actions"><button disabled={index === 0} onClick={() => movePack(index, -1)}>↑</button><button disabled={index === settings.sharedPackPaths.length - 1} onClick={() => movePack(index, 1)}>↓</button><button className="danger-button" onClick={() => removePack(path)}>{t("卸载")}</button></div></li>;
          })}
        </ol>
        {!privateLibraryPath && !settings.sharedPackPaths.length ? <p className="muted">{t("当前没有配置资料源。")} </p> : null}
        {hasDraftChanges ? <p className="status-chip warn">{t("社区资料设置尚未保存")}</p> : <p className="status-chip ok">{t("社区资料设置已保存")}</p>}
      </section>
      <DesktopPortablePackWorkbench privateLibraryPath={privateLibraryPath} profileName={profileName} runtimeContractRevision={runtimeContractRevision} packInfos={packInfos} onSharedInstalled={onSharedInstalled} onPrivateImported={onPrivateImported} setMessage={setMessage} />
      <section className="settings-card soft-card"><span className="eyebrow">READ ONLY</span><h2>{t("社区资料始终只读")}</h2><p>{t("你对作品和人物的编辑只保存在当前影片库，不会修改已安装的社区资料包。移除个人修改后，社区资料会重新显示。")}</p><button onClick={onOpenSettings}>{t("打开影片库设置")}</button></section>
    </div>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
