import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronLeft20Regular } from "@fluentui/react-icons";

import type {
  DesktopBootstrapSettings,
  DesktopLibraryProfile,
  DesktopRuntimeInfo,
  DesktopSharedPackInfo,
  DesktopTaskProgress,
} from "./contracts";
import type { WorkQuery } from "@/domain/queries/work-query";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { desktopBridge } from "./tauri-bridge";
import { useDesktopI18n } from "./desktop-i18n";
import { DesktopSidebar, DesktopTopbar, type DesktopPage, type DesktopSettingsModule } from "./desktop-app-shell";
import { DesktopFavoritesProvider } from "./desktop-favorites-provider";
import { UiButton } from "./ui/button";
import { UiEmptyState } from "./ui/feedback";
import { UiToast, type ToastTone } from "./ui/toast";
import type { DesktopWorkExplorerState } from "./desktop-work-explorer";
import {
  activeLibraryProfile,
  addLibraryProfile,
  applyLibraryProfile,
  ensureLibraryProfiles,
  isDevFixtureLibraryPath,
  syncActiveLibraryProfile,
} from "./library-profiles";

// Native Profile 命令的最小契约版本；低版本 Runtime 只能读取旧设置，不能安全保存多资料库配置。
const PROFILE_NATIVE_CONTRACT_REVISION = 2;
// 一次选择初始化依赖 Native 创建受控 Private Library，因此必须等待 revision 7。
const QUICK_SETUP_NATIVE_CONTRACT_REVISION = 7;

/**
 * 页面模块按需下载。React.lazy 接受默认导出，因此这里把各文件的命名导出映射成 default。
 * 这不会改变页面职责，只让用户首次打开某个页面时才加载它的代码。
 */
const DesktopHomePage = lazy(() => import("./desktop-home-page").then((module) => ({ default: module.DesktopHomePage })));
const DesktopWorksPage = lazy(() => import("./desktop-work-pages").then((module) => ({ default: module.DesktopWorksPage })));
const DesktopFavoritesPage = lazy(() => import("./desktop-favorites-page").then((module) => ({ default: module.DesktopFavoritesPage })));
const DesktopWorkDetailPage = lazy(() => import("./desktop-work-pages").then((module) => ({ default: module.DesktopWorkDetailPage })));
const DesktopPeoplePage = lazy(() => import("./desktop-person-pages").then((module) => ({ default: module.DesktopPeoplePage })));
const DesktopPersonDetailPage = lazy(() => import("./desktop-person-pages").then((module) => ({ default: module.DesktopPersonDetailPage })));
const DesktopCatalogBrowser = lazy(() => import("./desktop-catalog-browser").then((module) => ({ default: module.DesktopCatalogBrowser })));
const DesktopGovernance = lazy(() => import("./desktop-governance").then((module) => ({ default: module.DesktopGovernance })));
const DesktopMediaPage = lazy(() => import("./desktop-media-page").then((module) => ({ default: module.DesktopMediaPage })));
const DesktopPacksPage = lazy(() => import("./desktop-packs-page").then((module) => ({ default: module.DesktopPacksPage })));
const DesktopSettingsPage = lazy(() => import("./desktop-settings-page").then((module) => ({ default: module.DesktopSettingsPage })));
const DesktopAboutPage = lazy(() => import("./desktop-about-page").then((module) => ({ default: module.DesktopAboutPage })));

const DEFAULT_SETTINGS: DesktopBootstrapSettings = {
  schemaVersion: 1,
  libraryRoots: [],
  mediaScanPaths: [],
  nfoScanPaths: [],
  sharedPackPaths: [],
  webUrl: "http://127.0.0.1:3000",
};

type DetailTarget = { kind: "work" | "person"; id: string } | null;
type NavigationLocation = {
  page: DesktopPage;
  detail: DetailTarget;
  worksInitialQuery: WorkQuery | undefined;
  worksExplorerState: DesktopWorkExplorerState | undefined;
};

export default function App() {
  const { t } = useDesktopI18n();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem("localogue.desktop.sidebar-collapsed-v2") !== "false");
  const [settingsModule, setSettingsModule] = useState<DesktopSettingsModule>("library");
  const [runtime, setRuntime] = useState<DesktopRuntimeInfo | null>(null);
  const [settings, setSettings] = useState<DesktopBootstrapSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<DesktopBootstrapSettings>(DEFAULT_SETTINGS);
  const [packInfos, setPackInfos] = useState<DesktopSharedPackInfo[]>([]);
  const [page, setPage] = useState<DesktopPage>("home");
  const [detail, setDetail] = useState<DetailTarget>(null);
  const [worksInitialQuery, setWorksInitialQuery] = useState<WorkQuery | undefined>();
  const [messageState, setMessageState] = useState(() => ({ revision: 0, text: t("正在连接 Tauri Runtime…") }));
  const message = messageState.text;
  const messageTone = classifyMessageTone(message);
  const [busy, setBusy] = useState(false);
  const [libraryEpoch, setLibraryEpoch] = useState(0);
  const [progress, setProgress] = useState<DesktopTaskProgress | null>(null);
  // 递增令牌表达一次新的同步意图；Media 页面负责真正编排，避免 App 复制扫描业务。
  const [mediaSyncRequest, setMediaSyncRequest] = useState(0);
  const ordinarySaveQueue = useRef<Promise<void>>(Promise.resolve());
  const ordinarySaveCount = useRef(0);
  // Desktop 没有浏览器 URL 路由，因此显式保存用户真正访问过的位置。
  // 这样 Work -> Person -> Work 的关系跳转仍能逐级返回，而不是按实体类型猜测返回哪个列表。
  const navigationHistory = useRef<NavigationLocation[]>([]);
  const worksExplorerState = useRef<DesktopWorkExplorerState | undefined>(undefined);
  const currentLocation = useRef<NavigationLocation>({ page, detail, worksInitialQuery, worksExplorerState: undefined });
  currentLocation.current = { page, detail, worksInitialQuery, worksExplorerState: worksExplorerState.current };

  /**
   * 所有页面状态消息从这里汇合，因此日志接入不需要让一百多个调用点分别理解文件 I/O。
   * Native 端负责固定目录、轮转和路径脱敏；日志失败不能反过来阻断正常 UI。
   */
  const setMessage = useCallback((next: string) => {
    setMessageState((current) => ({ revision: current.revision + 1, text: next }));
    void desktopBridge.appendAppLog(/失败|无法|错误/.test(next) ? "error" : "info", next).catch(() => undefined);
  }, []);

  // 成功/普通提示只负责确认动作已完成，停留过久会挤占内容并形成视觉噪音。
  // 需要用户处理的错误和警告不会自动消失。
  useEffect(() => {
    if (!message || messageTone === "error" || messageTone === "warning") return;
    const revision = messageState.revision;
    const timer = window.setTimeout(() => setMessageState((current) => current.revision === revision ? { ...current, text: "" } : current), 4_500);
    return () => window.clearTimeout(timer);
  }, [message, messageState.revision, messageTone]);

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
    navigationHistory.current = [];
    setPage(next);
    setDetail(null);
    if (next === "works") {
      worksExplorerState.current = undefined;
      setWorksInitialQuery(undefined);
    }
  }, []);

  const filterWorks = useCallback((query: WorkQuery) => {
    navigationHistory.current = [];
    worksExplorerState.current = undefined;
    setWorksInitialQuery(query);
    setDetail(null);
    setPage("works");
  }, []);

  const openWork = useCallback((id: string) => {
    navigationHistory.current.push({ ...currentLocation.current, worksExplorerState: worksExplorerState.current });
    setPage("works");
    setDetail({ kind: "work", id });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const openPerson = useCallback((id: string) => {
    navigationHistory.current.push({ ...currentLocation.current, worksExplorerState: worksExplorerState.current });
    setPage("people");
    setDetail({ kind: "person", id });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const returnToPreviousLocation = useCallback(() => {
    const previous = navigationHistory.current.pop();
    if (!previous) {
      setDetail(null);
      return;
    }
    setPage(previous.page);
    setDetail(previous.detail);
    setWorksInitialQuery(previous.worksInitialQuery);
    worksExplorerState.current = previous.worksExplorerState;
  }, []);

  const refreshLibrary = useCallback(() => {
    setLibraryEpoch((value) => value + 1);
  }, []);

  const updateWorksExplorerState = useCallback((state: DesktopWorkExplorerState) => {
    worksExplorerState.current = state;
  }, []);

  const startUnifiedSync = useCallback(() => {
    navigationHistory.current = [];
    setDetail(null);
    setPage("media");
    setMediaSyncRequest((value) => value + 1);
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

  async function persistOrdinarySettings(
    next: DesktopBootstrapSettings,
    successMessage: string,
  ): Promise<DesktopBootstrapSettings> {
    ordinarySaveCount.current += 1;
    setBusy(true);
    let savedResult: DesktopBootstrapSettings | undefined;
    let saveError: unknown;
    const operation = ordinarySaveQueue.current
      .catch(() => undefined)
      .then(async () => {
        try {
          savedResult = await persistDesktopSettings(next);
          setMessage(successMessage);
        } catch (error) {
          saveError = error;
          setMessage(t("保存失败：{error}", { error: toMessage(error) }));
        }
      });
    ordinarySaveQueue.current = operation;
    try {
      await operation;
      if (saveError) throw saveError;
      if (!savedResult) throw new Error(t("保存失败：{error}", { error: "Unknown save result" }));
      return savedResult;
    } finally {
      ordinarySaveCount.current -= 1;
      if (ordinarySaveCount.current === 0) setBusy(false);
    }
  }

  async function switchLibraryProfile(profileId: string): Promise<void> {
    try {
      // 切换前先把当前界面值同步回旧 Profile；applyLibraryProfile 再替换路径字段，
      // ffprobe / Web URL 等全局普通设置因此不会被旧 savedSettings 覆盖。
      const prepared = syncActiveLibraryProfile(settings);
      const profile = (prepared.libraryProfiles ?? []).find((item) => item.id === profileId);
      if (!profile || profile.id === prepared.activeLibraryProfileId) return;
      const next = applyLibraryProfile(prepared, profile);
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

  async function quickSetupLibrary(): Promise<void> {
    if ((runtime?.contractRevision ?? 0) < QUICK_SETUP_NATIVE_CONTRACT_REVISION) {
      setMessage(t("首次设置需要新版 Native Runtime。请完全退出并重新启动 Desktop。"));
      return;
    }
    setBusy(true);
    try {
      // 新手只选择“内容在哪里”。Localogue 的 JSON 写入根由 Native 固定创建在 App Local Data。
      const contentRoot = await desktopBridge.pickDirectory();
      if (!contentRoot) return;
      const managed = await desktopBridge.provisionPrivateLibrary();
      const now = new Date().toISOString();
      const profile: DesktopLibraryProfile = {
        id: `library_${crypto.randomUUID()}`,
        name: t("我的资料库"),
        description: t("由首次设置自动创建"),
        libraryPath: managed.libraryPath,
        libraryRoots: [contentRoot],
        mediaScanPaths: [],
        nfoScanPaths: [],
        sharedPackPaths: [],
        createdAt: now,
        updatedAt: now,
      };
      const next = addLibraryProfile(ensureLibraryProfiles(savedSettings), profile);
      await persistDesktopSettings(next, { syncActiveProfile: false });
      setDetail(null);
      setPage("home");
      setMessage(t("资料库已经准备好。下一步点击首页的“一键同步”导入 NFO、图片和视频。"));
    } catch (error) {
      setMessage(t("首次设置失败：{error}", { error: toMessage(error) }));
    } finally {
      setBusy(false);
    }
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
          window.localStorage.setItem("localogue.desktop.sidebar-collapsed-v2", String(next));
          return next;
        })}
      />

      <main className="content-shell">
        <DesktopTopbar
          page={page}
          version={runtime?.version}
          settingsModule={settingsModule}
          onSearch={(text) => filterWorks({ text, sort: "release_desc" })}
          onNavigate={navigate}
          onSettingsModule={(module) => { setSettingsModule(module); navigate("settings"); }}
        />

        {detail ? <button className="desktop-floating-back" type="button" onClick={returnToPreviousLocation}><ChevronLeft20Regular />{t("返回上一页")}</button> : null}

        {message ? <UiToast key={messageState.revision} closeLabel={t("关闭")} onDismiss={() => setMessageState((current) => ({ ...current, text: "" }))} tone={messageTone}>{message}</UiToast> : null}

        <DesktopFavoritesProvider repository={repository} setMessage={setMessage}>
        <Suspense fallback={<PageLoadingState />}>
        {!hasLibrarySource && page !== "settings" && page !== "about" ? (
          <EmptyLibrary busy={busy} quickSetupReady={(runtime?.contractRevision ?? 0) >= QUICK_SETUP_NATIVE_CONTRACT_REVISION} onQuickSetup={() => void quickSetupLibrary()} onConfigure={() => navigate("settings")} />
        ) : page === "home" ? (
          <DesktopHomePage repository={repository} openWork={openWork} openPerson={openPerson} openWorks={() => navigate("works")} filterWorks={filterWorks} openMedia={() => navigate("media")} startUnifiedSync={startUnifiedSync} />
        ) : page === "works" ? (
          detail?.kind === "work" ? (
          <DesktopWorkDetailPage
              key={`${savedSettings.libraryPath ?? "shared"}:work:${detail.id}`}
              repository={repository}
              id={detail.id}
              onBack={returnToPreviousLocation}
              openPerson={openPerson}
              filterWorks={filterWorks}
              onLibraryChanged={refreshLibrary}
              setMessage={setMessage}
            />
          ) : (
            <DesktopWorksPage repository={repository} openWork={openWork} openPerson={openPerson} onLibraryChanged={refreshLibrary} setMessage={setMessage} initialQuery={worksInitialQuery} initialState={worksExplorerState.current} onExplorerStateChange={updateWorksExplorerState} />
          )
        ) : page === "favorites" ? (
          <DesktopFavoritesPage
            repository={repository}
            openWork={openWork}
          />
        ) : page === "people" ? (
          detail?.kind === "person" ? (
            <DesktopPersonDetailPage
              key={`${savedSettings.libraryPath ?? "shared"}:person:${detail.id}`}
              repository={repository}
              id={detail.id}
              onBack={returnToPreviousLocation}
              openWork={openWork}
              onLibraryChanged={refreshLibrary}
              setMessage={setMessage}
              runtimeContractRevision={runtime?.contractRevision ?? 0}
            />
          ) : (
            <DesktopPeoplePage repository={repository} openPerson={openPerson} onLibraryChanged={refreshLibrary} setMessage={setMessage} />
          )
        ) : page === "browse" ? (
          <DesktopCatalogBrowser repository={repository} openWork={openWork} setMessage={setMessage} />
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
            autoSyncRequest={mediaSyncRequest}
            onOpenSettings={() => navigate("settings")}
            onOpenLibrary={() => navigate("works")}
            openWork={openWork}
          />
        ) : page === "about" ? (
          <DesktopAboutPage runtime={runtime} setMessage={setMessage} />
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
            onPersistSettings={persistOrdinarySettings}
            onPersistProfiles={persistProfileMutation}
            onOpenPacks={() => navigate("packs")}
            settingsModule={settingsModule}
            setMessage={setMessage}
          />
        )}
        </Suspense>
        </DesktopFavoritesProvider>
      </main>
    </div>
  );
}

function EmptyLibrary({ busy, quickSetupReady, onQuickSetup, onConfigure }: { busy: boolean; quickSetupReady: boolean; onQuickSetup: () => void; onConfigure: () => void }) {
  const { t } = useDesktopI18n();
  return (
    <UiEmptyState
      className="large-empty"
      eyebrow="NO LIBRARY SOURCE"
      title={t("先连接你的资料库")}
      description={<>{t("选择存放影片、NFO 和封面的大目录。Localogue 会自动准备自己的数据空间，不会移动或改名原始文件。")}{!quickSetupReady ? <small className="muted">{t("请完全退出并重新启动 Desktop，以加载新版首次设置能力。")}</small> : null}</>}
      action={<div className="button-row"><UiButton variant="primary" loading={busy} disabled={!quickSetupReady} onClick={onQuickSetup}>{busy ? t("正在准备…") : t("选择影片资料目录")}</UiButton><UiButton variant="ghost" disabled={busy} onClick={onConfigure}>{t("高级设置")}</UiButton></div>}
    />
  );
}

/** 页面代码正在按需加载时保持稳定高度，避免 WebView 因内容骤缩跳回顶部。 */
function PageLoadingState() {
  const { t } = useDesktopI18n();
  return <UiEmptyState busy title={t("正在读取资料库…")} />;
}

function invalidPackInfo(path: string, error: unknown): DesktopSharedPackInfo {
  return {
    configuredPath: path,
    absolutePath: path,
    valid: false,
    error: toMessage(error),
  };
}

function classifyMessageTone(message: string): ToastTone {
  if (/失败|无法|错误|failed|error|cannot|失敗|エラー/i.test(message)) return "error";
  if (/请先|需要|警告|不可用|未配置|不能|禁止|拒绝|阻塞|warning|required|unavailable|cannot|blocked|please|必要|警告|禁止|拒否|利用できません/i.test(message)) return "warning";
  if (/已|完成|成功|保存|创建|删除|更新|导入|同步|连接|done|saved|created|deleted|updated|complete|success|完了|保存|作成|削除|更新|接続/i.test(message)) return "success";
  return "info";
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toMessage(error: unknown): string {
  if (error === undefined || error === null) return "未知错误";
  return error instanceof Error ? error.message : String(error);
}
