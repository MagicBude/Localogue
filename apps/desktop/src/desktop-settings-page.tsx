import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";

import type { DesktopBootstrapSettings, DesktopRuntimeInfo, DesktopSharedPackInfo } from "./contracts";
import { useDesktopI18n } from "./desktop-i18n";
import { InfoCard, PageTitle } from "./desktop-page-primitives";
import {
  activeLibraryProfile,
  addLibraryProfile,
  applyLibraryProfile,
  createLibraryProfile,
  createLibraryProfileId,
  hasUnsavedLibraryPaths,
  isDevFixtureLibraryPath,
  nextLibraryProfileName,
  removeLibraryProfile,
  renameLibraryProfile,
  syncActiveLibraryProfile,
} from "./library-profiles";
import { TauriFileDialogAdapter } from "./platform/tauri-platform-adapters";
import { desktopBridge } from "./tauri-bridge";
import type { DesktopSettingsModule } from "./desktop-app-shell";
import { UiButton } from "./ui/button";
import { UiActionDialog } from "./ui/action-dialog";
import { UiEmptyState, UiFeedback } from "./ui/feedback";
import { UiTextField } from "./ui/form-control";

// revision 11 同时保证 Profile 隔离、受控删除和 ffprobe 引导命令齐全；旧 EXE
// 若加载了较新的前端资源，应先提示重启，避免按钮调用不存在的 Native Command。
const PROFILE_NATIVE_CONTRACT_REVISION = 11;
const fileDialog = new TauriFileDialogAdapter();

/**
 * 设置页集中管理资料库 Profile 和路径草稿。
 * 路径选择只通过受限 Dialog Adapter，持久化由 App 注入，页面不自行写设置文件。
 */
export function DesktopSettingsPage({
  runtime,
  settings,
  setSettings,
  busy,
  packInfos,
  onSave,
  onPersistProfiles,
  onOpenPacks,
  settingsModule,
  setMessage,
}: {
  runtime: DesktopRuntimeInfo | null;
  settings: DesktopBootstrapSettings;
  setSettings: Dispatch<SetStateAction<DesktopBootstrapSettings>>;
  busy: boolean;
  packInfos: DesktopSharedPackInfo[];
  onSave: () => void;
  onPersistProfiles: (next: DesktopBootstrapSettings, successMessage: string) => Promise<DesktopBootstrapSettings>;
  onOpenPacks: () => void;
  settingsModule: DesktopSettingsModule;
  setMessage: (message: string) => void;
}) {
  const { t } = useDesktopI18n();
  const profiles = settings.libraryProfiles ?? [];
  const [ffprobeCheck, setFfprobeCheck] = useState<string>();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteManagedData, setDeleteManagedData] = useState(false);
  const selectedProfile = activeLibraryProfile(settings);
  const profileNativeRuntimeReady = (runtime?.contractRevision ?? 0) >= PROFILE_NATIVE_CONTRACT_REVISION;

  async function chooseLibrary(): Promise<void> {
    const path = await fileDialog.pickDirectory(settings.libraryPath);
    if (path) setSettings((current) => ({ ...current, libraryPath: path }));
  }

  async function createProfile(): Promise<void> {
    try {
      const prepared = syncActiveLibraryProfile(settings);
      const name = nextLibraryProfileName(prepared, t("资料库"));
      const profileId = createLibraryProfileId();
      const managed = await desktopBridge.provisionPrivateLibrary(profileId);
      const profile = createLibraryProfile(
        { ...prepared, libraryPath: managed.libraryPath, libraryRoots: [], mediaScanPaths: [], nfoScanPaths: [], sharedPackPaths: [] },
        profileId,
        name,
      );
      await onPersistProfiles(
        addLibraryProfile(prepared, profile),
        t("已新建资料库：{name}。Private Library 已自动准备好，只需添加内容根目录。", { name }),
      );
    } catch {
      // 父级已经显示保存错误。
    }
  }

  async function addDevFixtureProfile(): Promise<void> {
    try {
      const provisioned = await desktopBridge.provisionExampleLibrary();
      const prepared = syncActiveLibraryProfile(settings);
      const existing = (prepared.libraryProfiles ?? []).find((profile) => isDevFixtureLibraryPath(profile.libraryPath));
      const fixtureSettings: DesktopBootstrapSettings = {
        ...prepared,
        libraryPath: provisioned.libraryPath,
        libraryRoots: [],
        mediaScanPaths: [],
        nfoScanPaths: [],
        sharedPackPaths: provisioned.sharedPackPath ? [provisioned.sharedPackPath] : [],
      };
      const profile = createLibraryProfile(
        fixtureSettings,
        existing?.id ?? "library_profile_dev_fixture",
        t("示例库"),
      );
      const next = addLibraryProfile(fixtureSettings, {
        ...profile,
        description: t("Localogue 内置开发 / 功能展示 Fixture"),
        createdAt: existing?.createdAt ?? profile.createdAt,
      });
      await onPersistProfiles(
        next,
        t(provisioned.created
          ? "示例库已创建并加入资料库列表，可以直接从侧栏切换。"
          : "示例库已加入资料库列表，可以直接从侧栏切换。"),
      );
    } catch (error) {
      const detail = toMessage(error);
      const nativeCommandMissing = detail.includes("Command not found") || detail.includes("not allowed");
      setMessage(nativeCommandMissing
        ? t("Desktop Native Runtime 与当前界面版本不一致。请完全退出并重新启动 Desktop；开发环境若仍未更新，请执行一次 Rust clean 后重启。")
        : t("无法加入示例库：{error}", { error: detail }));
    }
  }

  async function selectProfile(profileId: string): Promise<void> {
    const profile = (settings.libraryProfiles ?? []).find((item) => item.id === profileId);
    if (!profile || profile.id === settings.activeLibraryProfileId) return;

    if (selectedProfile) {
      const activeSnapshot = applyLibraryProfile(settings, selectedProfile);
      if (hasUnsavedLibraryPaths(settings, activeSnapshot) && !window.confirm(t("当前设置页还有未保存的资料源修改。切换资料库会放弃这些修改，继续吗？"))) return;
    }

    try {
      await onPersistProfiles(applyLibraryProfile(settings, profile), t("已切换资料库：{name}", { name: profile.name }));
    } catch {
      // 父级已经显示保存错误。
    }
  }

  function openRenameProfile(): void {
    const profile = activeLibraryProfile(settings);
    if (!profile) return;
    setRenameDraft(profile.name);
    setRenameOpen(true);
  }

  async function renameProfile(): Promise<void> {
    const profile = activeLibraryProfile(settings);
    const name = renameDraft.trim();
    if (!profile || !name) return;
    try {
      const saved = await onPersistProfiles(
        renameLibraryProfile(settings, profile.id, name),
        t("资料库已重命名为：{name}", { name }),
      );
      const renamed = (saved.libraryProfiles ?? []).find((item) => item.id === profile.id);
      if (renamed?.name !== name) {
        setMessage(t("资料库重命名未能持久化，请重试。"));
      } else {
        setRenameOpen(false);
      }
    } catch {
      // 父级已经显示保存错误。
    }
  }

  function openDeleteProfile(): void {
    if (!activeLibraryProfile(settings)) return;
    setDeleteManagedData(false);
    setDeleteOpen(true);
  }

  async function deleteProfile(): Promise<void> {
    const profile = activeLibraryProfile(settings);
    if (!profile) return;
    const canDeleteManagedData = isManagedPrivateLibrary(profile.id, profile.libraryPath, runtime?.appLocalDataDir);
    const shouldDeleteManagedData = canDeleteManagedData && deleteManagedData;
    try {
      await onPersistProfiles(removeLibraryProfile(settings, profile.id), t("资料库配置已删除：{name}", { name: profile.name }));
      setDeleteOpen(false);
      if (shouldDeleteManagedData && profile.libraryPath) {
        try {
          await desktopBridge.deleteManagedPrivateLibrary(profile.id, profile.libraryPath);
          setMessage(t("资料库配置和 Localogue 管理数据已删除；影片原文件未删除。"));
        } catch (error) {
          setMessage(t("资料库配置已删除，但管理数据删除失败并仍保留在磁盘：{error}", { error: toMessage(error) }));
        }
      }
    } catch {
      // 父级已经显示保存错误。
    }
  }

  async function addSharedPack(): Promise<void> {
    const path = await fileDialog.pickDirectory(settings.sharedPackPaths.at(-1));
    if (!path) return;
    await persistPaths({ ...settings, sharedPackPaths: unique([...settings.sharedPackPaths, path]) }, t("共享资料目录已添加并保存。"));
  }

  async function addLibraryRoot(): Promise<void> {
    const path = await fileDialog.pickDirectory(settings.libraryRoots.at(-1));
    if (!path) return;
    await persistPaths({ ...settings, libraryRoots: unique([...settings.libraryRoots, path]) }, t("内容目录已添加并保存，可以直接开始同步。"));
  }

  async function addMediaRoot(): Promise<void> {
    const path = await fileDialog.pickDirectory(settings.mediaScanPaths.at(-1) ?? settings.libraryRoots.at(-1));
    if (!path) return;
    await persistPaths({ ...settings, mediaScanPaths: unique([...settings.mediaScanPaths, path]) }, t("额外媒体目录已添加并保存。"));
  }

  async function addNfoRoot(): Promise<void> {
    const path = await fileDialog.pickDirectory(settings.nfoScanPaths.at(-1) ?? settings.libraryRoots.at(-1));
    if (!path) return;
    await persistPaths({ ...settings, nfoScanPaths: unique([...settings.nfoScanPaths, path]) }, t("额外 NFO 目录已添加并保存。"));
  }

  async function persistPaths(next: DesktopBootstrapSettings, message: string): Promise<void> {
    try {
      await onPersistProfiles(syncActiveLibraryProfile(next), message);
    } catch {
      // 父级统一显示持久化错误，避免页面再弹出第二份错误。
    }
  }

  async function removePath(key: "libraryRoots" | "sharedPackPaths" | "mediaScanPaths" | "nfoScanPaths", path: string): Promise<void> {
    await persistPaths({ ...settings, [key]: settings[key].filter((item) => item !== path) }, t("目录已移除并保存。"));
  }

  async function openWeb(): Promise<void> {
    try {
      await desktopBridge.openWebUrl(settings.webUrl);
      setMessage(t("已交给系统浏览器打开 Localogue Web。"));
    } catch (error) {
      setMessage(t("无法打开 Web URL：{error}", { error: toMessage(error) }));
    }
  }

  async function chooseFfprobe(): Promise<void> {
    try {
      const path = await desktopBridge.pickFfprobeFile(settings.ffprobePath);
      if (path) {
        setSettings((current) => ({ ...current, ffprobePath: path }));
        setFfprobeCheck(undefined);
      }
    } catch (error) {
      setMessage(t("选择 ffprobe 失败：{error}", { error: toMessage(error) }));
    }
  }

  async function checkFfprobe(): Promise<void> {
    try {
      const version = await desktopBridge.checkFfprobe(settings.ffprobePath?.trim() || "ffprobe");
      setFfprobeCheck(version);
      setMessage(t("ffprobe 已可用：{version}", { version }));
    } catch (error) {
      setFfprobeCheck(undefined);
      setMessage(t("ffprobe 不可用：{error}", { error: toMessage(error) }));
    }
  }

  async function revealLog(): Promise<void> {
    try {
      await desktopBridge.revealAppLog();
      setMessage(t("已在文件管理器中定位 Localogue 日志。"));
    } catch (error) {
      setMessage(t("无法打开日志位置：{error}", { error: toMessage(error) }));
    }
  }

  return (
    <div className={`page-stack settings-page settings-mode-${settingsModule}`}>
      <PageTitle eyebrow="LIBRARY · SOURCES · PROFILES" title={t("资料库设置")} description={t("每个资料库独立保存可写数据、内容位置与共享资料；需要不同用途时新建资料库并自行命名，然后从侧栏快速切换。") } />

      {!profileNativeRuntimeReady ? (
        <UiFeedback tone="warning">
          {t("Desktop Native Runtime 与当前界面版本不一致。请完全退出并重新启动 Desktop；开发环境若仍未更新，请执行一次 Rust clean 后重启。")}
        </UiFeedback>
      ) : null}

      <section className="settings-card library-profile-card settings-module-library">
        <div className="section-heading">
          <div><span className="eyebrow">LIBRARY PROFILE</span><h2>{t("资料库")}</h2></div>
          <div className="button-row">
            <UiButton disabled={busy || !profileNativeRuntimeReady} onClick={() => void addDevFixtureProfile()}>{t("+ 添加示例库")}</UiButton>
            <UiButton variant="primary" disabled={busy || !profileNativeRuntimeReady} onClick={() => void createProfile()}>{t("+ 新建资料库")}</UiButton>
          </div>
        </div>
        <p className="muted">{t("新建资料库会自动获得独立的 Private Library；你只需添加影片所在的内容根目录。名称和高级设置以后都可以修改。")}</p>
        {profiles.length ? (
          <div className="profile-toolbar">
            <label>
              <span>{t("当前资料库")}</span>
              <select disabled={busy || !profileNativeRuntimeReady} value={settings.activeLibraryProfileId ?? selectedProfile?.id ?? ""} onChange={(event) => void selectProfile(event.target.value)}>
                <option value="" disabled>{t("选择资料库…")}</option>
                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
              </select>
            </label>
            <div className="button-row">
              <UiButton disabled={busy || !profileNativeRuntimeReady || !selectedProfile} onClick={openRenameProfile}>{t("重命名")}</UiButton>
              <UiButton variant="danger" disabled={busy || !profileNativeRuntimeReady || !selectedProfile} onClick={openDeleteProfile}>{t("删除资料库")}</UiButton>
            </div>
          </div>
        ) : <UiEmptyState title={t("还没有资料库")} description={t("点击“新建资料库”会创建“资料库 1”；也可以一键加入内置“示例库”体验功能。")} action={<UiButton variant="primary" disabled={busy || !profileNativeRuntimeReady} onClick={() => void createProfile()}>{t("+ 新建资料库")}</UiButton>} />}
      </section>

      <UiActionDialog
        actions={<><UiButton variant="ghost" onClick={() => setRenameOpen(false)}>{t("取消")}</UiButton><UiButton variant="primary" loading={busy} disabled={!renameDraft.trim()} onClick={() => void renameProfile()}>{t("保存修改")}</UiButton></>}
        closeLabel={t("关闭")}
        description={t("只修改 Localogue 中显示的资料库名称，不移动或重命名磁盘目录。")}
        onOpenChange={setRenameOpen}
        open={renameOpen}
        title={t("重命名资料库")}
      >
        <UiTextField autoFocus label={t("资料库配置名称")} value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && renameDraft.trim()) void renameProfile(); }} />
      </UiActionDialog>

      <UiActionDialog
        actions={<><UiButton variant="ghost" onClick={() => setDeleteOpen(false)}>{t("取消")}</UiButton><UiButton variant="danger" loading={busy} onClick={() => void deleteProfile()}>{deleteManagedData ? t("删除配置和管理数据") : t("只删除配置")}</UiButton></>}
        closeLabel={t("关闭")}
        description={t("默认只删除路径预设，不会移动、重命名或删除影片内容目录。")}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title={t("删除资料库“{name}”？", { name: selectedProfile?.name ?? "" })}
      >
        {selectedProfile && isManagedPrivateLibrary(selectedProfile.id, selectedProfile.libraryPath, runtime?.appLocalDataDir) ? <label className="ui-action-dialog__choice"><input type="checkbox" checked={deleteManagedData} onChange={(event) => setDeleteManagedData(event.target.checked)} /><span><strong>{t("同时删除 Localogue 管理数据")}</strong><small>{t("将永久删除该资料库中的作品、人物、图片副本和审计记录；影片内容根目录仍不会删除。")}</small></span></label> : null}
      </UiActionDialog>

      <details className="settings-card advanced-source-settings source-model-card settings-module-library">
        <summary><span><span className="eyebrow">PATH GUIDE</span><strong>{t("了解各种目录的用途")}</strong></span><small>{t("需要时展开")}</small></summary>
        <div className="source-model-grid advanced-settings-stack">
          <article><strong>1 · {t("私人资料库")}</strong><p>{t("Localogue 自己维护的可写 Canonical / Evidence / Asset / MediaFile。每个资料库配置通常只对应一个。")}</p></article>
          <article><strong>2 · {t("内容根目录")}</strong><p>{t("推荐入口。你的影片、NFO、poster、fanart 可以散在子目录里，Localogue 会递归发现并按番号汇聚。")}</p></article>
          <article><strong>3 · {t("只读共享资料")}</strong><p>{t("公共元数据基础层，例如 localogue-community-data。只读，且永远低于你的 Private Library。")}</p></article>
          <article><strong>4 · {t("高级兼容目录")}</strong><p>{t("只有媒体或 NFO / 图片完全放在内容根目录之外时才需要；普通用户可以不展开。")}</p></article>
        </div>
      </details>

      <details className="settings-card advanced-source-settings settings-module-library">
        <summary><span><span className="eyebrow">PRIVATE STORAGE</span><strong>{t("私人资料存储位置")}</strong></span><small>{t("通常无需修改")}</small></summary>
        <div className="advanced-settings-stack">
          <p className="muted">{t("这里只放 Localogue 生成和维护的结构化资料；不要把影片文件直接要求放进这个目录。")}</p>
          <code className="path-block">{settings.libraryPath || t("尚未选择")}</code>
          <div className="button-row"><button onClick={() => void chooseLibrary()}>{t("选择目录")}</button>{settings.libraryPath ? <button className="danger-button" onClick={() => setSettings((current) => ({ ...current, libraryPath: undefined }))}>{t("清除 Private Library")}</button> : null}</div>
        </div>
      </details>

      <section className="settings-card featured-card settings-module-library">
        <div className="section-heading"><div><span className="eyebrow">CONTENT ROOTS</span><h2>{t("内容根目录（推荐）")}</h2></div><button className="primary-button" onClick={() => void addLibraryRoot()}>{t("+ 添加资料源")}</button></div>
        <p className="muted">{t("优先只配置这里。一个根目录下可以同时有影片、NFO、poster / fanart / thumb，也可以按 VR / 影视 / 字幕等任意方式分子目录。")}</p>
        <PathList values={settings.libraryRoots} onRemove={(path) => void removePath("libraryRoots", path)} />
      </section>

      <section className="settings-card settings-module-sources">
        <div className="section-heading"><div><span className="eyebrow">SHARED PACKS</span><h2>{t("只读共享资料")}</h2></div><div className="button-row"><button onClick={() => void addSharedPack()}>{t("+ 挂载资料包")}</button><button className="primary-button" onClick={onOpenPacks}>{t("导入、导出与备份")}</button></div></div>
        <p className="muted">{t("适合社区公共元数据。推荐继续把 localogue-community-data 作为独立 Shared Pack 维护，而不是复制进每个私人资料库。")}</p>
        <PathList values={settings.sharedPackPaths} onRemove={(path) => void removePath("sharedPackPaths", path)} />
        {packInfos.length ? <p className="muted">{t("当前已保存配置中：{valid} 个有效，{invalid} 个需要检查。", { valid: packInfos.filter((item) => item.valid).length, invalid: packInfos.filter((item) => !item.valid).length })}</p> : null}
      </section>

      <details className="settings-card advanced-source-settings settings-module-tools">
        <summary><span><span className="eyebrow">ADVANCED COMPATIBILITY</span><strong>{t("高级兼容目录")}</strong></span><small>{t("大多数用户不需要配置")}</small></summary>
        <div className="advanced-settings-stack">
          <div>
            <div className="section-heading"><div><h3>{t("额外媒体目录")}</h3></div><button onClick={() => void addMediaRoot()}>{t("+ 添加目录")}</button></div>
            <p className="muted">{t("只在影片不位于上面的内容根目录中时添加；多个目录会全部参与同步和媒体扫描。")}</p>
            <PathList values={settings.mediaScanPaths} onRemove={(path) => void removePath("mediaScanPaths", path)} />
          </div>
          <div>
            <div className="section-heading"><div><h3>{t("额外 NFO / 图片目录")}</h3></div><button onClick={() => void addNfoRoot()}>{t("+ 添加目录")}</button></div>
            <p className="muted">{t("只在 NFO / 海报完全放在另一处时添加；这里也会参与 poster / fanart / thumb 发现。")}</p>
            <PathList values={settings.nfoScanPaths} onRemove={(path) => void removePath("nfoScanPaths", path)} />
          </div>
        </div>
      </details>

      <section className="settings-card form-card settings-module-tools">
        <div>
          <div className="section-heading"><div><h3>ffprobe</h3><p className="muted">{t("用于读取视频清晰度、时长和编码。留空会依次查找安装包资源和系统 PATH；找不到时仍能扫描作品文件。")}</p></div><div className="button-row"><button onClick={() => void chooseFfprobe()}>{t("选择 ffprobe.exe")}</button><button onClick={() => void checkFfprobe()}>{t("检测可用性")}</button></div></div>
          <UiTextField label={t("ffprobe 可执行文件路径")} value={settings.ffprobePath ?? ""} placeholder="ffprobe" onChange={(event: ChangeEvent<HTMLInputElement>) => { setSettings((current) => ({ ...current, ffprobePath: event.target.value })); setFfprobeCheck(undefined); }} />
          {ffprobeCheck ? <UiFeedback tone="success">{t("已检测：{version}", { version: ffprobeCheck })}</UiFeedback> : null}
        </div>
        <label>Localogue Web URL<input value={settings.webUrl} onChange={(event: ChangeEvent<HTMLInputElement>) => setSettings((current) => ({ ...current, webUrl: event.target.value }))} /></label>
        <div className="button-row"><button onClick={() => void openWeb()}>{t("浏览器打开 Web")}</button><button className="primary-button" disabled={busy} onClick={onSave}>{busy ? t("保存中…") : t("保存桌面设置")}</button></div>
      </section>

      <section className="settings-card soft-card settings-module-about">
        <span className="eyebrow">RUNTIME</span>
        <h2>Tauri Runtime</h2>
        <div className="runtime-info-grid">
          <InfoCard label={t("产品")} value={runtime?.productName} />
          <InfoCard label={t("版本")} value={runtime?.version} />
          <InfoCard label={t("标识符")} value={runtime?.identifier} />
          <InfoCard label={t("环境")} value={runtime?.environment} />
        </div>
        <code className="path-block">{runtime?.settingsPath ?? "—"}</code>
        <div className="button-row"><button onClick={() => void revealLog()}>{t("打开日志位置")}</button></div>
      </section>
    </div>
  );
}

function PathList({ values, onRemove }: { values: string[]; onRemove: (value: string) => void }) {
  const { t } = useDesktopI18n();
  if (!values.length) return <p className="muted">{t("尚未配置。")} </p>;
  return <ul className="path-list">{values.map((path) => <li key={path}><code>{path}</code><button className="danger-button" onClick={() => onRemove(path)}>{t("移除")}</button></li>)}</ul>;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isManagedPrivateLibrary(profileId: string, libraryPath?: string, appLocalDataDir?: string): boolean {
  if (!libraryPath || !appLocalDataDir) return false;
  const normalize = (value: string) => value.replaceAll("\\", "/").replace(/\/+$/, "").toLocaleLowerCase();
  return normalize(libraryPath) === `${normalize(appLocalDataDir)}/libraries/${profileId.toLocaleLowerCase()}`;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
