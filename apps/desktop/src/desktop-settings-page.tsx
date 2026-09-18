import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";

import type { DesktopBootstrapSettings, DesktopContentFolder, DesktopRuntimeInfo, DesktopSharedPackInfo, DesktopStorageSyncReport } from "./contracts";
import { useDesktopI18n } from "./desktop-i18n";
import { PageTitle } from "./desktop-page-primitives";
import {
  activeLibraryProfile,
  addLibraryProfile,
  createEmptyLibraryProfile,
  createLibraryProfileId,
  isDevFixtureLibraryPath,
  nextLibraryProfileName,
  removeLibraryProfile,
  renameLibraryProfile,
  selectLibraryProfile,
  updateLibraryProfile,
} from "./library-profiles";
import { TauriFileDialogAdapter } from "./platform/tauri-platform-adapters";
import { desktopBridge } from "./tauri-bridge";
import type { DesktopSettingsModule } from "./desktop-app-shell";
import { UiButton } from "./ui/button";
import { UiActionDialog } from "./ui/action-dialog";
import { UiEmptyState, UiFeedback } from "./ui/feedback";
import { UiSelectField, UiTextField } from "./ui/form-control";

// revision 14 同时保证 Profile 隔离、受控删除、ffprobe 引导和 SQLite 私人读取命令齐全；旧 EXE
// 若加载了较新的前端资源，应先提示重启，避免按钮调用不存在的 Native Command。
const PROFILE_NATIVE_CONTRACT_REVISION = 15;
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
  onPersistSettings,
  onPersistProfiles,
  onStartLibrarySync,
  onAddContentFolder,
  onUpdateContentFolder,
  onRemoveContentFolder,
  onOpenPacks,
  settingsModule,
  setMessage,
}: {
  runtime: DesktopRuntimeInfo | null;
  settings: DesktopBootstrapSettings;
  setSettings: Dispatch<SetStateAction<DesktopBootstrapSettings>>;
  busy: boolean;
  packInfos: DesktopSharedPackInfo[];
  onPersistSettings: (next: DesktopBootstrapSettings, successMessage: string) => Promise<DesktopBootstrapSettings>;
  onPersistProfiles: (next: DesktopBootstrapSettings, successMessage: string) => Promise<DesktopBootstrapSettings>;
  onStartLibrarySync: () => void;
  onAddContentFolder: () => void;
  onUpdateContentFolder: (path: string, patch: Partial<DesktopContentFolder>) => void;
  onRemoveContentFolder: (path: string) => void;
  onOpenPacks: () => void;
  settingsModule: DesktopSettingsModule;
  setMessage: (message: string) => void;
}) {
  const { t } = useDesktopI18n();
  const profiles = settings.libraryProfiles;
  const [ffprobeCheck, setFfprobeCheck] = useState<string>();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteManagedData, setDeleteManagedData] = useState(false);
  const [storageReport, setStorageReport] = useState<DesktopStorageSyncReport>();
  const [checkingStorage, setCheckingStorage] = useState(false);
  const selectedProfile = activeLibraryProfile(settings);
  const selectedProfileIsManaged = Boolean(selectedProfile && isManagedPrivateLibrary(selectedProfile.id, selectedProfile.libraryPath, runtime?.appLocalDataDir));
  const profileNativeRuntimeReady = (runtime?.contractRevision ?? 0) >= PROFILE_NATIVE_CONTRACT_REVISION;

  async function chooseLibrary(): Promise<void> {
    if (!selectedProfile) return;
    const path = await fileDialog.pickDirectory(selectedProfile.libraryPath);
    if (path) await persistPaths(updateLibraryProfile(settings, selectedProfile.id, { libraryPath: path }), t("私人资料存储位置已自动保存。"));
  }

  async function revealLibrary(): Promise<void> {
    if (!selectedProfile?.libraryPath) return;
    try {
      await desktopBridge.revealInFolder(selectedProfile.libraryPath);
    } catch (error) {
      setMessage(t("无法打开数据存储位置：{error}", { error: toMessage(error) }));
    }
  }

  async function createProfile(): Promise<void> {
    try {
      const contentRoot = await fileDialog.pickDirectory();
      if (!contentRoot) return;
      const name = nextLibraryProfileName(settings, t("影片库"));
      const profileId = createLibraryProfileId();
      const managed = await desktopBridge.provisionPrivateLibrary(profileId);
      const profile = {
        ...createEmptyLibraryProfile(profileId, name),
        libraryPath: managed.libraryPath,
        contentFolders: [{ path: contentRoot, scanVideo: true, scanNfo: true, scanImages: true }],
      };
      await onPersistProfiles(
        addLibraryProfile(settings, profile),
        t("已新建影片库：{name}。正在扫描首个内容目录。", { name }),
      );
      onStartLibrarySync();
    } catch {
      // 父级已经显示保存错误。
    }
  }

  async function completeEmptyProfile(): Promise<void> {
    if (!selectedProfile || selectedProfile.contentFolders.length) return;
    try {
      const contentRoot = await fileDialog.pickDirectory();
      if (!contentRoot) return;
      await onPersistProfiles(
        updateLibraryProfile(settings, selectedProfile.id, {
          contentFolders: [{ path: contentRoot, scanVideo: true, scanNfo: true, scanImages: true }],
        }),
        t("内容目录已保存，正在开始扫描。"),
      );
      onStartLibrarySync();
    } catch {
      // 父级已经显示保存错误。
    }
  }

  async function addDevFixtureProfile(): Promise<void> {
    try {
      const provisioned = await desktopBridge.provisionExampleLibrary();
      const existing = settings.libraryProfiles.find((profile) => isDevFixtureLibraryPath(profile.libraryPath));
      const profile = createEmptyLibraryProfile(existing?.id ?? "library_profile_dev_fixture", t("示例库"));
      const next = addLibraryProfile(settings, {
        ...profile,
        libraryPath: provisioned.libraryPath,
        sharedPackPaths: provisioned.sharedPackPath ? [provisioned.sharedPackPath] : [],
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
    const profile = settings.libraryProfiles.find((item) => item.id === profileId);
    if (!profile || profile.id === settings.activeLibraryProfileId) return;

    try {
      await onPersistProfiles(selectLibraryProfile(settings, profileId), t("已切换影片库：{name}", { name: profile.name }));
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
        t("影片库已重命名为：{name}", { name }),
      );
      const renamed = (saved.libraryProfiles ?? []).find((item) => item.id === profile.id);
      if (renamed?.name !== name) {
        setMessage(t("影片库重命名未能保存，请重试。"));
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
      await onPersistProfiles(removeLibraryProfile(settings, profile.id), t("影片库已从列表移除：{name}", { name: profile.name }));
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
    if (!selectedProfile) return;
    const path = await fileDialog.pickDirectory(selectedProfile.sharedPackPaths.at(-1));
    if (!path) return;
    await persistPaths(updateLibraryProfile(settings, selectedProfile.id, { sharedPackPaths: unique([...selectedProfile.sharedPackPaths, path]) }), t("共享资料目录已添加并保存。"));
  }

  async function persistPaths(next: DesktopBootstrapSettings, message: string): Promise<void> {
    try {
      await onPersistProfiles(next, message);
    } catch {
      // 父级统一显示持久化错误，避免页面再弹出第二份错误。
    }
  }

  async function removeSharedPack(path: string): Promise<void> {
    if (!selectedProfile) return;
    await persistPaths(updateLibraryProfile(settings, selectedProfile.id, { sharedPackPaths: selectedProfile.sharedPackPaths.filter((item) => item !== path) }), t("目录已移除并保存。"));
  }

  async function chooseFfprobe(): Promise<void> {
    try {
      const path = await desktopBridge.pickFfprobeFile(settings.ffprobePath);
      if (path) {
        await saveOrdinarySettings({ ...settings, ffprobePath: path }, t("ffprobe 路径已自动保存。"));
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

  async function saveOrdinarySettings(next: DesktopBootstrapSettings, message: string): Promise<void> {
    try {
      await onPersistSettings(next, message);
    } catch {
      // App 统一显示保存失败并保留当前输入，用户修正后可再次离开字段触发保存。
    }
  }

  async function inspectStorageSync(): Promise<void> {
    setCheckingStorage(true);
    try {
      setStorageReport(await desktopBridge.inspectLocalSqliteSync());
    } catch (error) {
      setMessage(t("数据库对账失败：{error}", { error: toMessage(error) }));
    } finally {
      setCheckingStorage(false);
    }
  }

  return (
    <div className={`page-stack settings-page settings-mode-${settingsModule}`}>
      <PageTitle eyebrow="LIBRARY · SOURCES · PROFILES" title={t("影片库设置")} description={t("每个影片库独立保存内容目录、个人修改和收藏；需要分开管理时新建影片库，然后从侧栏切换。") } />

      {!profileNativeRuntimeReady ? (
        <UiFeedback tone="warning">
          {t("Desktop Native Runtime 与当前界面版本不一致。请完全退出并重新启动 Desktop；开发环境若仍未更新，请执行一次 Rust clean 后重启。")}
        </UiFeedback>
      ) : null}

      <section className="settings-card library-profile-card settings-module-library">
        <div className="section-heading">
          <div><span className="eyebrow">LIBRARY PROFILE</span><h2>{t("影片库")}</h2></div>
          <div className="button-row">
            <UiButton disabled={busy || !profileNativeRuntimeReady} onClick={() => void addDevFixtureProfile()}>{t("+ 添加示例库")}</UiButton>
            <UiButton variant="primary" disabled={busy || !profileNativeRuntimeReady} onClick={() => void createProfile()}>{t("+ 新建影片库")}</UiButton>
          </div>
        </div>
        <p className="muted">{t("新建影片库时选择首个内容目录，Localogue 会准备独立的数据存储位置并直接开始扫描。名称和高级设置以后都可以修改。")}</p>
        {profiles.length ? (
          <div className="profile-toolbar">
            <UiSelectField label={t("当前影片库")} disabled={busy || !profileNativeRuntimeReady} value={settings.activeLibraryProfileId ?? selectedProfile?.id ?? ""} onChange={(event) => void selectProfile(event.target.value)}>
                <option value="" disabled>{t("选择影片库…")}</option>
                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </UiSelectField>
            <div className="button-row">
              {selectedProfile && !selectedProfile.contentFolders.length ? <UiButton variant="primary" disabled={busy || !profileNativeRuntimeReady} onClick={() => void completeEmptyProfile()}>{t("选择内容目录并开始扫描")}</UiButton> : null}
              <UiButton disabled={busy || !profileNativeRuntimeReady || !selectedProfile} onClick={openRenameProfile}>{t("重命名")}</UiButton>
              <UiButton variant="danger" disabled={busy || !profileNativeRuntimeReady || !selectedProfile} onClick={openDeleteProfile}>{t("移除影片库")}</UiButton>
            </div>
          </div>
        ) : <UiEmptyState title={t("还没有影片库")} description={t("点击“新建影片库”会创建“影片库 1”；也可以加入内置示例库体验功能。")} action={<UiButton variant="primary" disabled={busy || !profileNativeRuntimeReady} onClick={() => void createProfile()}>{t("+ 新建影片库")}</UiButton>} />}
      </section>

      <LibraryContentFoldersSection
        folders={selectedProfile?.contentFolders ?? []}
        busy={busy}
        onAdd={onAddContentFolder}
        onUpdate={onUpdateContentFolder}
        onRemove={onRemoveContentFolder}
        onScan={onStartLibrarySync}
        disabled={!selectedProfile || !profileNativeRuntimeReady}
      />

      <UiActionDialog
        actions={<><UiButton variant="ghost" onClick={() => setRenameOpen(false)}>{t("取消")}</UiButton><UiButton variant="primary" loading={busy} disabled={!renameDraft.trim()} onClick={() => void renameProfile()}>{t("保存修改")}</UiButton></>}
        closeLabel={t("关闭")}
        description={t("只修改 Localogue 中显示的影片库名称，不移动或重命名磁盘目录。")}
        onOpenChange={setRenameOpen}
        open={renameOpen}
        title={t("重命名影片库")}
      >
        <UiTextField autoFocus label={t("影片库名称")} value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && renameDraft.trim()) void renameProfile(); }} />
      </UiActionDialog>

      <UiActionDialog
        actions={<><UiButton variant="ghost" onClick={() => setDeleteOpen(false)}>{t("取消")}</UiButton><UiButton variant="danger" loading={busy} onClick={() => void deleteProfile()}>{deleteManagedData ? t("移除影片库并删除管理数据") : t("只从列表移除")}</UiButton></>}
        closeLabel={t("关闭")}
        description={selectedProfileIsManaged ? t("只从列表移除会保留 Localogue 管理数据；如需一并清理，请在下方明确勾选。内容目录和原始视频始终保留。") : t("这个影片库使用用户选择的数据存储位置。移除后磁盘资料会完整保留，Localogue 不会递归删除用户目录。")}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title={t("移除影片库“{name}”？", { name: selectedProfile?.name ?? "" })}
      >
        {selectedProfileIsManaged ? <label className="ui-action-dialog__choice"><input type="checkbox" checked={deleteManagedData} onChange={(event) => setDeleteManagedData(event.target.checked)} /><span><strong>{t("同时删除 Localogue 管理数据")}</strong><small>{t("将永久删除这个影片库的作品资料、图片副本和审计记录；内容目录和原始视频不会删除。")}</small></span></label> : <UiFeedback tone="info">{t("如需清理这个自选目录，请在文件管理器中自行确认内容；Localogue 不会把它当作缓存自动删除。")}</UiFeedback>}
      </UiActionDialog>

      <details className="settings-card advanced-source-settings source-model-card settings-module-library">
        <summary><span><span className="eyebrow">PATH GUIDE</span><strong>{t("了解各种目录的用途")}</strong></span><small>{t("需要时展开")}</small></summary>
        <div className="source-model-grid advanced-settings-stack">
          <article><strong>1 · {t("数据存储位置")}</strong><p>{t("保存这个影片库的作品资料、个人修改、收藏和管理记录，通常由 Localogue 自动设置。")}</p></article>
          <article><strong>2 · {t("内容目录")}</strong><p>{t("内容目录、扫描范围和首次扫描都在当前影片库设置中完成；“扫描任务”用于查看实时进度和高级排查。")}</p></article>
          <article><strong>3 · {t("社区资料")}</strong><p>{t("社区整理的只读作品、人物和分类资料，不包含你的视频、收藏和私人修改。")}</p></article>
          <article><strong>4 · {t("高级兼容目录")}</strong><p>{t("只有媒体或 NFO / 图片完全放在内容根目录之外时才需要；普通用户可以不展开。")}</p></article>
        </div>
      </details>

      <details className="settings-card advanced-source-settings settings-module-library">
        <summary><span><span className="eyebrow">PRIVATE STORAGE</span><strong>{t("数据存储位置")}</strong></span><small>{t("通常无需修改")}</small></summary>
        <div className="advanced-settings-stack">
          <p className="muted">{t("这里只放 Localogue 生成和维护的结构化资料；不要把影片文件直接要求放进这个目录。")}</p>
          <code className="path-block">{selectedProfile?.libraryPath || t("尚未选择")}</code>
          <div className="button-row">{selectedProfile?.libraryPath ? <UiButton onClick={() => void revealLibrary()}>{t("打开文件夹")}</UiButton> : null}<UiButton disabled={!selectedProfile} onClick={() => void chooseLibrary()}>{t("更改位置")}</UiButton>{selectedProfile?.libraryPath ? <UiButton variant="danger" onClick={() => void persistPaths(updateLibraryProfile(settings, selectedProfile.id, { libraryPath: undefined }), t("数据存储位置已清除并自动保存。"))}>{t("清除位置")}</UiButton> : null}</div>
        </div>
      </details>

      <section className="settings-card settings-module-sources">
        <div className="section-heading"><div><span className="eyebrow">COMMUNITY DATA</span><h2>{t("社区资料")}</h2></div><div className="button-row"><UiButton onClick={() => void addSharedPack()}>{t("+ 添加社区资料")}</UiButton><UiButton variant="primary" onClick={onOpenPacks}>{t("社区资料与个人备份")}</UiButton></div></div>
        <p className="muted">{t("社区资料提供只读的作品、人物、厂商、系列、分类和多语言名称，不包含你的原始视频、收藏、评分或私人修改。")}</p>
        <PathList values={selectedProfile?.sharedPackPaths ?? []} onRemove={(path) => void removeSharedPack(path)} />
        {packInfos.length ? <p className="muted">{t("当前已保存配置中：{valid} 个有效，{invalid} 个需要检查。", { valid: packInfos.filter((item) => item.valid).length, invalid: packInfos.filter((item) => !item.valid).length })}</p> : null}
      </section>

      <section className="settings-card form-card settings-module-tools">
        <div>
          <div className="section-heading"><div><h3>ffprobe</h3><p className="muted">{t("用于读取视频清晰度、时长和编码。留空会依次查找安装包资源和系统 PATH；找不到时仍能扫描作品文件。")}</p></div><div className="button-row"><UiButton disabled={busy} onClick={() => void chooseFfprobe()}>{t("选择 ffprobe.exe")}</UiButton><UiButton disabled={busy} onClick={() => void checkFfprobe()}>{t("检测可用性")}</UiButton></div></div>
          <UiTextField label={t("ffprobe 可执行文件路径")} description={t("修改后离开输入框即自动保存。") } value={settings.ffprobePath ?? ""} placeholder="ffprobe" onChange={(event: ChangeEvent<HTMLInputElement>) => { setSettings((current) => ({ ...current, ffprobePath: event.target.value })); setFfprobeCheck(undefined); }} onBlur={(event) => void saveOrdinarySettings({ ...settings, ffprobePath: event.currentTarget.value }, t("ffprobe 路径已自动保存。"))} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          {ffprobeCheck ? <UiFeedback tone="success">{t("已检测：{version}", { version: ffprobeCheck })}</UiFeedback> : null}
        </div>
        <UiFeedback tone="info">{t("当前 Desktop 版本不内置 Web 服务；Localogue Web 需要单独启动 Web 运行入口，因此这里不再提供容易误解的浏览器按钮。")}</UiFeedback>
      </section>

      <section className="settings-card settings-module-tools">
        <div className="section-heading">
          <div><span className="eyebrow">STORAGE MIGRATION</span><h2>{t("JSON / SQLite 对账")}</h2></div>
          <UiButton disabled={!selectedProfile?.libraryPath || checkingStorage || !profileNativeRuntimeReady} loading={checkingStorage} onClick={() => void inspectStorageSync()}>{t("检查同步状态")}</UiButton>
        </div>
        <p className="muted">{t("迁移期间 JSON 保留为交换、审核和回滚格式；local.db 是同步的运行时投影。只有差异为零才可切换数据库读取。")}</p>
        {storageReport ? !storageReport.available ? (
          <UiFeedback tone="info">{t("当前私人资料库还没有 local.db，请先执行迁移构建。")}</UiFeedback>
        ) : (
          <UiFeedback tone={storageReport.missingInSqlite.length || storageReport.missingInJson.length || storageReport.contentMismatches.length ? "warning" : "success"}>
            {t("JSON {json} 项，SQLite {sqlite} 项；缺少 {missing} 项，内容差异 {mismatch} 项。", { json: storageReport.jsonCount, sqlite: storageReport.sqliteCount, missing: storageReport.missingInSqlite.length + storageReport.missingInJson.length, mismatch: storageReport.contentMismatches.length })}
          </UiFeedback>
        ) : null}
      </section>

    </div>
  );
}

function PathList({ values, onRemove }: { values: string[]; onRemove: (value: string) => void }) {
  const { t } = useDesktopI18n();
  if (!values.length) return <p className="muted">{t("尚未配置。")} </p>;
  return <ul className="path-list">{values.map((path) => <li key={path}><code>{path}</code><UiButton size="compact" variant="danger" onClick={() => onRemove(path)}>{t("移除")}</UiButton></li>)}</ul>;
}

function LibraryContentFoldersSection({ folders, busy, disabled, onAdd, onUpdate, onRemove, onScan }: { folders: DesktopContentFolder[]; busy: boolean; disabled: boolean; onAdd: () => void; onUpdate: (path: string, patch: Partial<DesktopContentFolder>) => void; onRemove: (path: string) => void; onScan: () => void }) {
  const { t } = useDesktopI18n();
  const canScan = folders.some((folder) => folder.scanVideo || folder.scanNfo || folder.scanImages);
  return <section className="settings-card library-content-folders settings-module-library">
    <div className="section-heading"><div><span className="eyebrow">CONTENT SOURCES</span><h2>{t("内容目录")}</h2><p className="muted">{t("当前影片库会从这里发现 NFO、图片和视频；保存后可立即扫描，不需要再跳到其他页面配置。")}</p></div><div className="button-row"><UiButton disabled={busy || disabled} onClick={onAdd}>{t("+ 添加内容目录")}</UiButton><UiButton variant="primary" disabled={busy || disabled || !canScan} onClick={onScan}>{t("扫描全部目录")}</UiButton></div></div>
    {folders.length ? <div className="library-content-folder-list">{folders.map((folder) => <article key={folder.path}><div><strong title={folder.path}>{folder.path}</strong><div className="directory-scope-options"><label><input type="checkbox" checked={folder.scanVideo} disabled={disabled} onChange={(event) => onUpdate(folder.path, { scanVideo: event.target.checked })} />{t("视频")}</label><label><input type="checkbox" checked={folder.scanNfo} disabled={disabled} onChange={(event) => onUpdate(folder.path, { scanNfo: event.target.checked })} />NFO</label><label><input type="checkbox" checked={folder.scanImages} disabled={disabled} onChange={(event) => onUpdate(folder.path, { scanImages: event.target.checked })} />{t("图片")}</label></div></div><UiButton size="compact" variant="danger" disabled={busy || disabled} onClick={() => onRemove(folder.path)}>{t("移除")}</UiButton></article>)}</div> : <UiFeedback tone="warning">{t("这个影片库还没有内容目录。添加一个目录后，Localogue 才能发现和扫描影片资料。")}</UiFeedback>}
  </section>;
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
