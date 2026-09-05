import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  DesktopBootstrapSettings,
  DesktopRuntimeInfo,
  DesktopSharedPackInfo,
  DesktopTaskProgress,
} from "./contracts";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { desktopBridge } from "./tauri-bridge";
import { useDesktopI18n } from "./desktop-i18n";
import { DesktopSidebar, DesktopTopbar, type DesktopPage } from "./desktop-app-shell";
import {
  activeLibraryProfile,
  applyLibraryProfile,
  ensureLibraryProfiles,
  hasUnsavedLibraryPaths,
  isDevFixtureLibraryPath,
  syncActiveLibraryProfile,
} from "./library-profiles";

// Native Profile 命令的最小契约版本；低版本 Runtime 只能读取旧设置，不能安全保存多资料库配置。
const PROFILE_NATIVE_CONTRACT_REVISION = 2;

/**
 * 页面模块按需下载。React.lazy 接受默认导出，因此这里把各文件的命名导出映射成 default。
 * 这不会改变页面职责，只让用户首次打开某个页面时才加载它的代码。
 */
const DesktopHomePage = lazy(() => import("./desktop-home-page").then((module) => ({ default: module.DesktopHomePage })));
const DesktopWorksPage = lazy(() => import("./desktop-work-pages").then((module) => ({ default: module.DesktopWorksPage })));
const DesktopWorkDetailPage = lazy(() => import("./desktop-work-pages").then((module) => ({ default: module.DesktopWorkDetailPage })));
const DesktopPeoplePage = lazy(() => import("./desktop-person-pages").then((module) => ({ default: module.DesktopPeoplePage })));
const DesktopPersonDetailPage = lazy(() => import("./desktop-person-pages").then((module) => ({ default: module.DesktopPersonDetailPage })));
const DesktopCatalogBrowser = lazy(() => import("./desktop-catalog-browser").then((module) => ({ default: module.DesktopCatalogBrowser })));
const DesktopGovernance = lazy(() => import("./desktop-governance").then((module) => ({ default: module.DesktopGovernance })));
const DesktopMediaPage = lazy(() => import("./desktop-media-page").then((module) => ({ default: module.DesktopMediaPage })));
const DesktopPacksPage = lazy(() => import("./desktop-packs-page").then((module) => ({ default: module.DesktopPacksPage })));
const DesktopSettingsPage = lazy(() => import("./desktop-settings-page").then((module) => ({ default: module.DesktopSettingsPage })));

const DEFAULT_SETTINGS: DesktopBootstrapSettings = {
  schemaVersion: 1,
  libraryRoots: [],
  mediaScanPaths: [],
  nfoScanPaths: [],
  sharedPackPaths: [],
  webUrl: "http://127.0.0.1:3000",
};

type DetailTarget = { kind: "work" | "person"; id: string } | null;

export default function App() {
  const { t } = useDesktopI18n();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem("localogue.desktop.sidebar-collapsed") === "true");
  const [runtime, setRuntime] = useState<DesktopRuntimeInfo | null>(null);
  const [settings, setSettings] = useState<DesktopBootstrapSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<DesktopBootstrapSettings>(DEFAULT_SETTINGS);
  const [packInfos, setPackInfos] = useState<DesktopSharedPackInfo[]>([]);
  const [page, setPage] = useState<DesktopPage>("home");
  const [detail, setDetail] = useState<DetailTarget>(null);
  const [message, setMessage] = useState(() => t("正在连接 Tauri Runtime…"));
  const [busy, setBusy] = useState(false);
  const [libraryEpoch, setLibraryEpoch] = useState(0);
  const [progress, setProgress] = useState<DesktopTaskProgress | null>(null);

  const refreshSources = useCallback(async (next: DesktopBootstrapSettings) => {
    const inspected = await Promise.all(
      next.sharedPackPaths.map(async (path) => {
        try {
          return await desktopBridge.inspectSharedPack(path);
        } catch (error) {
          return invalidPackInfo(path, error);
        }
      }),
    );
    setPackInfos(inspected);
    setLibraryEpoch((value) => value + 1);
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void Promise.all([desktopBridge.runtimeInfo(), desktopBridge.loadSettings()])
      .then(async ([runtimeInfo, saved]) => {
        if (disposed) return;
        let prepared = ensureLibraryProfiles(saved);

        // V1-24C：旧版本创建的“示例库”可能只有 Private Fixture，没有配套 Starter Shared Pack。
        // 只对内置示例 Profile 做一次向前修复；普通用户资料库绝不自动挂载任何 Shared Pack。
        const exampleProfile = (prepared.libraryProfiles ?? []).find((profile) =>
          isDevFixtureLibraryPath(profile.libraryPath) && profile.sharedPackPaths.length === 0,
        );
        if (exampleProfile && (runtimeInfo.contractRevision ?? 0) >= 5) {
          try {
            const provisioned = await desktopBridge.provisionExampleLibrary();
            if (provisioned.sharedPackPath) {
              const updatedProfile = {
                ...exampleProfile,
                libraryPath: provisioned.libraryPath,
                sharedPackPaths: [provisioned.sharedPackPath],
                updatedAt: new Date().toISOString(),
              };
              let repaired: DesktopBootstrapSettings = {
                ...prepared,
                libraryProfiles: (prepared.libraryProfiles ?? []).map((profile) =>
                  profile.id === exampleProfile.id ? updatedProfile : profile,
                ),
              };
              if (prepared.activeLibraryProfileId === exampleProfile.id) {
                repaired = applyLibraryProfile(repaired, updatedProfile);
              }
              prepared = ensureLibraryProfiles(await desktopBridge.saveSettings(repaired));
            }
          } catch {
            // 示例 Shared Pack 修复失败不阻断 Desktop 启动；设置页“添加示例库”仍可显式重试。
          }
        }

        setRuntime(runtimeInfo);
        setSettings(prepared);
        setSavedSettings(prepared);
        await refreshSources(prepared);
        if (!disposed) setMessage(t("Desktop 已连接；正在直接读取 Localogue Canonical Library。"));
      })
      .catch((error: unknown) => {
        if (!disposed) setMessage(t("无法连接 Desktop Runtime：{error}", { error: toMessage(error) }));
      });

    void desktopBridge.listenProgress((payload) => {
      if (!disposed) setProgress(payload);
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [refreshSources, t]);

  const readRoots = useMemo(
    () => [
      ...(savedSettings.libraryPath ? [savedSettings.libraryPath] : []),
      ...packInfos.flatMap((pack) =>
        pack.valid && pack.libraryPath ? [pack.libraryPath] : [],
      ),
    ],
    [savedSettings.libraryPath, packInfos, libraryEpoch],
  );

  const repository = useMemo(
    () => new TauriLibraryRepository(readRoots, savedSettings.libraryPath ?? null),
    [readRoots, savedSettings.libraryPath, libraryEpoch],
  );

  const savedActiveProfile = activeLibraryProfile(savedSettings);

  const navigate = useCallback((next: DesktopPage) => {
    setPage(next);
    setDetail(null);
  }, []);

  const openWork = useCallback((id: string) => {
    setPage("works");
    setDetail({ kind: "work", id });
  }, []);

  const openPerson = useCallback((id: string) => {
    setPage("people");
    setDetail({ kind: "person", id });
  }, []);

  const refreshLibrary = useCallback(() => {
    setLibraryEpoch((value) => value + 1);
  }, []);

  async function persistDesktopSettings(
    next: DesktopBootstrapSettings,
    options: { syncActiveProfile?: boolean } = {},
  ): Promise<DesktopBootstrapSettings> {
    // 普通设置保存要把当前路径草稿写回 active Profile；Profile 自身的增删改切换
    // 已经显式构造了完整状态，不能再做一次 active snapshot。
    const prepared = ensureLibraryProfiles(
      options.syncActiveProfile === false ? next : syncActiveLibraryProfile(next),
    );
    const saved = ensureLibraryProfiles(await desktopBridge.saveSettings(prepared));
    setSettings(saved);
    setSavedSettings(saved);
    await refreshSources(saved);
    return saved;
  }

  async function saveSettings(): Promise<void> {
    setBusy(true);
    try {
      await persistDesktopSettings(settings);
      setMessage(t("Desktop 实例设置已保存；当前资料库配置、资料源与 Shared Packs 已重新加载。"));
    } catch (error) {
      setMessage(t("保存失败：{error}", { error: toMessage(error) }));
    } finally {
      setBusy(false);
    }
  }

  async function persistProfileMutation(
    next: DesktopBootstrapSettings,
    successMessage: string,
  ): Promise<DesktopBootstrapSettings> {
    if ((runtime?.contractRevision ?? 0) < PROFILE_NATIVE_CONTRACT_REVISION) {
      const error = new Error(t("Desktop Native Runtime 与当前界面版本不一致。请完全退出并重新启动 Desktop；开发环境若仍未更新，请执行一次 Rust clean 后重启。"));
      setMessage(error.message);
      throw error;
    }
    setBusy(true);
    try {
      const saved = await persistDesktopSettings(next, { syncActiveProfile: false });
      setDetail(null);
      setMessage(successMessage);
      return saved;
    } catch (error) {
      setMessage(t("资料库配置保存失败：{error}", { error: toMessage(error) }));
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function switchLibraryProfile(profileId: string): Promise<void> {
    const profile = (savedSettings.libraryProfiles ?? []).find((item) => item.id === profileId);
    if (!profile || profile.id === savedSettings.activeLibraryProfileId) return;
    if (hasUnsavedLibraryPaths(settings, savedSettings) && !window.confirm(t("当前设置页还有未保存的资料源修改。切换资料库会放弃这些修改，继续吗？"))) return;

    try {
      const next = applyLibraryProfile(savedSettings, profile);
      await persistProfileMutation(next, t("已切换资料库：{name}", { name: profile.name }));
    } catch {
      // persistProfileMutation 已给出错误信息。
    }
  }

  async function installSharedPackPath(path: string): Promise<void> {
    const current = ensureLibraryProfiles(await desktopBridge.loadSettings());
    const next = syncActiveLibraryProfile({ ...current, sharedPackPaths: unique([...current.sharedPackPaths, path]) });
    const saved = ensureLibraryProfiles(await desktopBridge.saveSettings(next));
    setSettings(saved);
    setSavedSettings(saved);
    await refreshSources(saved);
  }

  const hasLibrarySource = readRoots.length > 0;
  const profileNativeRuntimeReady = (runtime?.contractRevision ?? 0) >= PROFILE_NATIVE_CONTRACT_REVISION;

  return (
    <div className={sidebarCollapsed ? "desktop-layout is-sidebar-collapsed" : "desktop-layout"}>
      <DesktopSidebar
        page={page}
        collapsed={sidebarCollapsed}
        runtime={runtime}
        settings={savedSettings}
        packInfos={packInfos}
        busy={busy}
        profileSwitchEnabled={profileNativeRuntimeReady}
        onNavigate={navigate}
        onSwitchProfile={(profileId) => void switchLibraryProfile(profileId)}
        onToggleCollapsed={() => setSidebarCollapsed((value) => {
          const next = !value;
          window.localStorage.setItem("localogue.desktop.sidebar-collapsed", String(next));
          return next;
        })}
      />

      <main className="content-shell">
        <DesktopTopbar
          page={page}
          version={runtime?.version}
          onRefresh={refreshLibrary}
          onOpenSettings={() => navigate("settings")}
        />

        <div className="status-line">{message}</div>

        <Suspense fallback={<PageLoadingState />}>
        {!hasLibrarySource && page !== "settings" ? (
          <EmptyLibrary onConfigure={() => navigate("settings")} />
        ) : page === "home" ? (
          <DesktopHomePage repository={repository} openWork={openWork} openPerson={openPerson} openWorks={() => navigate("works")} />
        ) : page === "works" ? (
          detail?.kind === "work" ? (
          <DesktopWorkDetailPage
              repository={repository}
              id={detail.id}
              onBack={() => setDetail(null)}
              openPerson={openPerson}
              onLibraryChanged={refreshLibrary}
              setMessage={setMessage}
            />
          ) : (
            <DesktopWorksPage repository={repository} openWork={openWork} onLibraryChanged={refreshLibrary} setMessage={setMessage} />
          )
        ) : page === "people" ? (
          detail?.kind === "person" ? (
            <DesktopPersonDetailPage
              repository={repository}
              id={detail.id}
              onBack={() => setDetail(null)}
              openWork={openWork}
              onLibraryChanged={refreshLibrary}
              setMessage={setMessage}
              runtimeContractRevision={runtime?.contractRevision ?? 0}
            />
          ) : (
            <DesktopPeoplePage repository={repository} openPerson={openPerson} onLibraryChanged={refreshLibrary} setMessage={setMessage} />
          )
        ) : page === "browse" ? (
          <DesktopCatalogBrowser repository={repository} openWork={openWork} />
        ) : page === "review" ? (
          <DesktopGovernance repository={repository} privateRoot={savedSettings.libraryPath ?? null} section="review" openWork={openWork} openPerson={openPerson} onLibraryChanged={refreshLibrary} setMessage={setMessage} />
        ) : page === "curation" ? (
          <DesktopGovernance repository={repository} privateRoot={savedSettings.libraryPath ?? null} section="curation" openWork={openWork} openPerson={openPerson} onLibraryChanged={refreshLibrary} setMessage={setMessage} />
        ) : page === "history" ? (
          <DesktopGovernance repository={repository} privateRoot={savedSettings.libraryPath ?? null} section="history" openWork={openWork} openPerson={openPerson} onLibraryChanged={refreshLibrary} setMessage={setMessage} />
        ) : page === "media" ? (
          <DesktopMediaPage
            repository={repository}
            settings={savedSettings}
            setMessage={setMessage}
            progress={progress}
            onLibraryChanged={refreshLibrary}
            runtimeContractRevision={runtime?.contractRevision ?? 0}
          />
        ) : page === "packs" ? (
          <DesktopPacksPage
            settings={settings}
            setSettings={setSettings}
            privateLibraryPath={savedSettings.libraryPath}
            profileName={savedActiveProfile?.name}
            runtimeContractRevision={runtime?.contractRevision ?? 0}
            packInfos={packInfos}
            busy={busy}
            onSave={saveSettings}
            setMessage={setMessage}
            onOpenSettings={() => navigate("settings")}
            onSharedInstalled={installSharedPackPath}
            onPrivateImported={refreshLibrary}
          />
        ) : (
          <DesktopSettingsPage
            runtime={runtime}
            settings={settings}
            setSettings={setSettings}
            busy={busy}
            packInfos={packInfos}
            onSave={() => void saveSettings()}
            onPersistProfiles={persistProfileMutation}
            setMessage={setMessage}
          />
        )}
        </Suspense>
      </main>
    </div>
  );
}

function EmptyLibrary({ onConfigure }: { onConfigure: () => void }) {
  const { t } = useDesktopI18n();
  return (
    <section className="empty-state large-empty">
      <span className="eyebrow">NO LIBRARY SOURCE</span>
      <h1>{t("先连接你的资料库")}</h1>
      <p>{t("Desktop 不再依赖浏览器页面。配置 Private Library 或挂载 Shared Pack 后，Works / People / Media 会直接在这个窗口读取同一套 Canonical JSON。")}</p>
      <button className="primary-button" onClick={onConfigure}>{t("打开设置")}</button>
    </section>
  );
}

/** 页面代码正在按需加载时保持稳定高度，避免 WebView 因内容骤缩跳回顶部。 */
function PageLoadingState() {
  const { t } = useDesktopI18n();
  return <section className="empty-state"><div className="loading-dot" /><strong>{t("正在读取资料库…")}</strong></section>;
}

function invalidPackInfo(path: string, error: unknown): DesktopSharedPackInfo {
  return {
    configuredPath: path,
    absolutePath: path,
    valid: false,
    error: toMessage(error),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toMessage(error: unknown): string {
  if (error === undefined || error === null) return "未知错误";
  return error instanceof Error ? error.message : String(error);
}
