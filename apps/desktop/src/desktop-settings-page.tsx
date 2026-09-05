import type { ChangeEvent, Dispatch, SetStateAction } from "react";

import type { DesktopBootstrapSettings, DesktopRuntimeInfo, DesktopSharedPackInfo } from "./contracts";
import { useDesktopI18n } from "./desktop-i18n";
import {
  activeLibraryProfile,
  addLibraryProfile,
  applyLibraryProfile,
  createEmptyLibraryProfile,
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

const PROFILE_NATIVE_CONTRACT_REVISION = 2;
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
  setMessage,
}: {
  runtime: DesktopRuntimeInfo | null;
  settings: DesktopBootstrapSettings;
  setSettings: Dispatch<SetStateAction<DesktopBootstrapSettings>>;
  busy: boolean;
  packInfos: DesktopSharedPackInfo[];
  onSave: () => void;
  onPersistProfiles: (next: DesktopBootstrapSettings, successMessage: string) => Promise<DesktopBootstrapSettings>;
  setMessage: (message: string) => void;
}) {
  const { t } = useDesktopI18n();
  const profiles = settings.libraryProfiles ?? [];
  const selectedProfile = activeLibraryProfile(settings);
  const profileNativeRuntimeReady = (runtime?.contractRevision ?? 0) >= PROFILE_NATIVE_CONTRACT_REVISION;

  async function chooseLibrary(): Promise<void> {
    const path = await fileDialog.pickDirectory();
    if (path) setSettings((current) => ({ ...current, libraryPath: path }));
  }

  async function createProfile(): Promise<void> {
    const prepared = syncActiveLibraryProfile(settings);
    const name = nextLibraryProfileName(prepared, t("资料库"));
    const next = addLibraryProfile(prepared, createEmptyLibraryProfile(createLibraryProfileId(), name));
    try {
      await onPersistProfiles(next, t("已新建资料库：{name}。现在可以为它选择 Private Library / 内容根目录。", { name }));
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

  async function renameProfile(): Promise<void> {
    const profile = activeLibraryProfile(settings);
    if (!profile) return;
    const name = window.prompt(t("资料库配置名称"), profile.name);
    if (!name?.trim()) return;
    try {
      const saved = await onPersistProfiles(
        renameLibraryProfile(settings, profile.id, name),
        t("资料库已重命名为：{name}", { name: name.trim() }),
      );
      const renamed = (saved.libraryProfiles ?? []).find((item) => item.id === profile.id);
      if (renamed?.name !== name.trim()) {
        setMessage(t("资料库重命名未能持久化，请重试。"));
      }
    } catch {
      // 父级已经显示保存错误。
    }
  }

  async function deleteProfile(): Promise<void> {
    const profile = activeLibraryProfile(settings);
    if (!profile) return;
    if (!window.confirm(t("删除资料库配置“{name}”？只删除路径预设，不会删除磁盘上的资料。", { name: profile.name }))) return;
    try {
      await onPersistProfiles(removeLibraryProfile(settings, profile.id), t("资料库配置已删除：{name}", { name: profile.name }));
    } catch {
      // 父级已经显示保存错误。
    }
  }

  async function addSharedPack(): Promise<void> {
    const path = await fileDialog.pickDirectory();
    if (!path) return;
    setSettings((current) => ({ ...current, sharedPackPaths: unique([...current.sharedPackPaths, path]) }));
  }

  async function addLibraryRoot(): Promise<void> {
    const path = await fileDialog.pickDirectory();
    if (!path) return;
    setSettings((current) => ({ ...current, libraryRoots: unique([...current.libraryRoots, path]) }));
  }

  async function addMediaRoot(): Promise<void> {
    const path = await fileDialog.pickDirectory();
    if (!path) return;
    setSettings((current) => ({ ...current, mediaScanPaths: unique([...current.mediaScanPaths, path]) }));
  }

  async function addNfoRoot(): Promise<void> {
    const path = await fileDialog.pickDirectory();
    if (!path) return;
    setSettings((current) => ({ ...current, nfoScanPaths: unique([...current.nfoScanPaths, path]) }));
  }

  async function openWeb(): Promise<void> {
    try {
      await desktopBridge.openWebUrl(settings.webUrl);
      setMessage(t("已交给系统浏览器打开 Localogue Web。"));
    } catch (error) {
      setMessage(t("无法打开 Web URL：{error}", { error: toMessage(error) }));
    }
  }

  return (
    <div className="page-stack">
      <PageTitle eyebrow="LIBRARY · SOURCES · PROFILES" title={t("资料库设置")} description={t("每个资料库独立保存可写数据、内容位置与共享资料；需要不同用途时新建资料库并自行命名，然后从侧栏快速切换。") } />

      {!profileNativeRuntimeReady ? (
        <div className="status-line">
          {t("Desktop Native Runtime 与当前界面版本不一致。请完全退出并重新启动 Desktop；开发环境若仍未更新，请执行一次 Rust clean 后重启。")}
        </div>
      ) : null}

      <section className="settings-card library-profile-card">
        <div className="section-heading">
          <div><span className="eyebrow">LIBRARY PROFILE</span><h2>{t("资料库")}</h2></div>
          <div className="button-row">
            <button disabled={busy || !profileNativeRuntimeReady} onClick={() => void addDevFixtureProfile()}>{t("+ 添加示例库")}</button>
            <button className="primary-button" disabled={busy || !profileNativeRuntimeReady} onClick={() => void createProfile()}>{t("+ 新建资料库")}</button>
          </div>
        </div>
        <p className="muted">{t("新建资料库默认使用“资料库 1、资料库 2…”等中性名称，不预设内容分类；名称可随时修改。每个资料库会记住 Private Library、内容根目录、高级兼容目录和 Shared Packs。")}</p>
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
              <button disabled={busy || !profileNativeRuntimeReady || !selectedProfile} onClick={() => void renameProfile()}>{t("重命名")}</button>
              <button className="danger-button" disabled={busy || !profileNativeRuntimeReady || !selectedProfile} onClick={() => void deleteProfile()}>{t("删除资料库")}</button>
            </div>
          </div>
        ) : <p className="empty-profile-hint">{t("还没有资料库。点击“新建资料库”会创建“资料库 1”；也可以一键加入内置“示例库”体验功能。")}</p>}
      </section>

      <section className="settings-card source-model-card">
        <span className="eyebrow">HOW SOURCES FIT TOGETHER</span>
        <h2>{t("四种路径怎么理解")}</h2>
        <div className="source-model-grid">
          <article><strong>1 · {t("私人资料库")}</strong><p>{t("Localogue 自己维护的可写 Canonical / Evidence / Asset / MediaFile。每个资料库配置通常只对应一个。")}</p></article>
          <article><strong>2 · {t("内容根目录")}</strong><p>{t("推荐入口。你的影片、NFO、poster、fanart 可以散在子目录里，Localogue 会递归发现并按番号汇聚。")}</p></article>
          <article><strong>3 · {t("只读共享资料")}</strong><p>{t("公共元数据基础层，例如 localogue-community-data。只读，且永远低于你的 Private Library。")}</p></article>
          <article><strong>4 · {t("高级兼容目录")}</strong><p>{t("只有媒体或 NFO / 图片完全放在内容根目录之外时才需要；普通用户可以不展开。")}</p></article>
        </div>
      </section>

      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">PRIVATE LIBRARY</span><h2>{t("私人资料库（可写）")}</h2></div><button onClick={() => void chooseLibrary()}>{t("选择目录")}</button></div>
        <p className="muted">{t("这里只放 Localogue 生成和维护的结构化资料；不要把影片文件直接要求放进这个目录。")}</p>
        <code className="path-block">{settings.libraryPath || t("尚未选择")}</code>
        {settings.libraryPath ? <button className="danger-button" onClick={() => setSettings((current) => ({ ...current, libraryPath: undefined }))}>{t("清除 Private Library")}</button> : null}
      </section>

      <section className="settings-card featured-card">
        <div className="section-heading"><div><span className="eyebrow">CONTENT ROOTS</span><h2>{t("内容根目录（推荐）")}</h2></div><button className="primary-button" onClick={() => void addLibraryRoot()}>{t("+ 添加资料源")}</button></div>
        <p className="muted">{t("优先只配置这里。一个根目录下可以同时有影片、NFO、poster / fanart / thumb，也可以按 VR / 影视 / 字幕等任意方式分子目录。")}</p>
        <PathList values={settings.libraryRoots} onRemove={(path) => setSettings((current) => ({ ...current, libraryRoots: current.libraryRoots.filter((item) => item !== path) }))} />
      </section>

      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">SHARED PACKS</span><h2>{t("只读共享资料")}</h2></div><button onClick={() => void addSharedPack()}>{t("+ 挂载资料包")}</button></div>
        <p className="muted">{t("适合社区公共元数据。推荐继续把 localogue-community-data 作为独立 Shared Pack 维护，而不是复制进每个私人资料库。")}</p>
        <PathList values={settings.sharedPackPaths} onRemove={(path) => setSettings((current) => ({ ...current, sharedPackPaths: current.sharedPackPaths.filter((item) => item !== path) }))} />
        {packInfos.length ? <p className="muted">{t("当前已保存配置中：{valid} 个有效，{invalid} 个需要检查。", { valid: packInfos.filter((item) => item.valid).length, invalid: packInfos.filter((item) => !item.valid).length })}</p> : null}
      </section>

      <details className="settings-card advanced-source-settings">
        <summary><span><span className="eyebrow">ADVANCED COMPATIBILITY</span><strong>{t("高级兼容目录")}</strong></span><small>{t("大多数用户不需要配置")}</small></summary>
        <div className="advanced-settings-stack">
          <div>
            <div className="section-heading"><div><h3>{t("额外媒体目录")}</h3></div><button onClick={() => void addMediaRoot()}>{t("+ 添加目录")}</button></div>
            <p className="muted">{t("只在影片不位于上面的内容根目录中时添加；多个目录会全部参与同步和媒体扫描。")}</p>
            <PathList values={settings.mediaScanPaths} onRemove={(path) => setSettings((current) => ({ ...current, mediaScanPaths: current.mediaScanPaths.filter((item) => item !== path) }))} />
          </div>
          <div>
            <div className="section-heading"><div><h3>{t("额外 NFO / 图片目录")}</h3></div><button onClick={() => void addNfoRoot()}>{t("+ 添加目录")}</button></div>
            <p className="muted">{t("只在 NFO / 海报完全放在另一处时添加；这里也会参与 poster / fanart / thumb 发现。")}</p>
            <PathList values={settings.nfoScanPaths} onRemove={(path) => setSettings((current) => ({ ...current, nfoScanPaths: current.nfoScanPaths.filter((item) => item !== path) }))} />
          </div>
        </div>
      </details>

      <section className="settings-card form-card">
        <label>ffprobe<input value={settings.ffprobePath ?? ""} placeholder="ffprobe" onChange={(event: ChangeEvent<HTMLInputElement>) => setSettings((current) => ({ ...current, ffprobePath: event.target.value }))} /></label>
        <label>Localogue Web URL<input value={settings.webUrl} onChange={(event: ChangeEvent<HTMLInputElement>) => setSettings((current) => ({ ...current, webUrl: event.target.value }))} /></label>
        <div className="button-row"><button onClick={() => void openWeb()}>{t("浏览器打开 Web")}</button><button className="primary-button" disabled={busy} onClick={onSave}>{busy ? t("保存中…") : t("保存桌面设置")}</button></div>
      </section>

      <section className="settings-card soft-card">
        <span className="eyebrow">RUNTIME</span>
        <h2>Tauri Runtime</h2>
        <div className="runtime-info-grid">
          <InfoCard label={t("产品")} value={runtime?.productName} />
          <InfoCard label={t("版本")} value={runtime?.version} />
          <InfoCard label={t("标识符")} value={runtime?.identifier} />
          <InfoCard label={t("环境")} value={runtime?.environment} />
        </div>
        <code className="path-block">{runtime?.settingsPath ?? "—"}</code>
      </section>
    </div>
  );
}

function PathList({ values, onRemove }: { values: string[]; onRemove: (value: string) => void }) {
  const { t } = useDesktopI18n();
  if (!values.length) return <p className="muted">{t("尚未配置。")} </p>;
  return <ul className="path-list">{values.map((path) => <li key={path}><code>{path}</code><button className="danger-button" onClick={() => onRemove(path)}>{t("移除")}</button></li>)}</ul>;
}

function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></section>;
}

function InfoCard({ label, value }: { label: string; value?: string }) {
  return <article className="info-card"><span>{label}</span><strong>{value && value !== "—" ? value : "—"}</strong></article>;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

