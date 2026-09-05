import {
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
import { DesktopCatalogBrowser } from "./desktop-catalog-browser";
import { DesktopGovernance } from "./desktop-governance";
import { DesktopLanguageControls, useDesktopI18n } from "./desktop-i18n";
import { DesktopWorkDetailPage, DesktopWorksPage } from "./desktop-work-pages";
import { DesktopPeoplePage, DesktopPersonDetailPage } from "./desktop-person-pages";
import { DesktopHomePage } from "./desktop-home-page";
import { DesktopMediaPage } from "./desktop-media-page";
import { DesktopPacksPage } from "./desktop-packs-page";
import { DesktopSettingsPage } from "./desktop-settings-page";
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

const DEFAULT_SETTINGS: DesktopBootstrapSettings = {
  schemaVersion: 1,
  libraryRoots: [],
  mediaScanPaths: [],
  nfoScanPaths: [],
  sharedPackPaths: [],
  webUrl: "http://127.0.0.1:3000",
};

type DesktopPage = "home" | "works" | "people" | "browse" | "review" | "curation" | "history" | "media" | "packs" | "settings";
type DetailTarget = { kind: "work" | "person"; id: string } | null;

const NAV_ITEMS: Array<{ id: DesktopPage; label: string; eyebrow: string; short: string }> = [
  { id: "home", label: "首页", eyebrow: "HOME", short: "HM" },
  { id: "works", label: "作品", eyebrow: "WORKS", short: "WK" },
  { id: "people", label: "人物", eyebrow: "PEOPLE", short: "PP" },
  { id: "browse", label: "浏览", eyebrow: "BROWSE", short: "BR" },
  { id: "review", label: "审核", eyebrow: "REVIEW", short: "RV" },
  { id: "curation", label: "治理", eyebrow: "CURATION", short: "CU" },
  { id: "history", label: "历史", eyebrow: "HISTORY", short: "HI" },
  { id: "media", label: "媒体", eyebrow: "MEDIA", short: "MD" },
  { id: "packs", label: "资料包", eyebrow: "PACKS", short: "PK" },
  { id: "settings", label: "设置", eyebrow: "SETTINGS", short: "ST" },
];

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
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("home")}>
          <span className="brand-mark">L</span>
          <span className="brand-copy">
            <strong>Localogue</strong>
            <small>{`Desktop · ${runtime?.version ?? "…"}`}</small>
          </span>
        </button>

        <nav className="nav-list" aria-label="Desktop navigation">
          {NAV_ITEMS.map((item) => (
            <button
              className={page === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => navigate(item.id)}
            >
              <span className="nav-item-short" aria-hidden="true">{item.short}</span>
              <span className="nav-item-label">{t(item.label)}</span>
              <small>{item.eyebrow}</small>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="source-summary">
          <span className="eyebrow">{t("当前资料库")}</span>
          {savedSettings.libraryProfiles?.length ? (
            <>
              <strong className="source-profile-name">{savedActiveProfile?.name ?? t("未绑定配置")}</strong>
              <select
                className="source-profile-select"
                aria-label={t("快速切换资料库")}
                disabled={busy || !profileNativeRuntimeReady}
                value={savedSettings.activeLibraryProfileId ?? ""}
                onChange={(event) => void switchLibraryProfile(event.target.value)}
              >
                <option value="" disabled>{t("选择资料库…")}</option>
                {savedSettings.libraryProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
              </select>
            </>
          ) : <strong className="source-profile-name">{t("尚未创建资料库")}</strong>}
          <small>
            {savedSettings.libraryPath
              ? t("Private + {count} Shared", { count: packInfos.filter((item) => item.valid).length })
              : t("{count} Shared", { count: packInfos.filter((item) => item.valid).length })}
          </small>
          <button className="source-profile-manage" type="button" onClick={() => navigate("settings")}>
            {t(savedSettings.libraryProfiles?.length ? "管理资料库" : "+ 新建资料库")}
          </button>
        </div>
        <button
          className="sidebar-collapse-button"
          title={sidebarCollapsed ? t("展开侧边栏") : t("收起侧边栏")}
          aria-label={sidebarCollapsed ? t("展开侧边栏") : t("收起侧边栏")}
          onClick={() => setSidebarCollapsed((value) => {
            const next = !value;
            window.localStorage.setItem("localogue.desktop.sidebar-collapsed", String(next));
            return next;
          })}
          type="button"
        >
          <span aria-hidden="true">{sidebarCollapsed ? "→" : "←"}</span>
          <span className="sidebar-collapse-label">{sidebarCollapsed ? t("展开侧边栏") : t("收起侧边栏")}</span>
        </button>
        <div className="runtime-pill">
          <span className={runtime ? "runtime-dot online" : "runtime-dot"} />
          <span>{runtime ? `${runtime.environment} · ${runtime.version}` : "connecting"}</span>
        </div>
      </aside>

      <main className="content-shell">
        <header className="topbar">
          <div>
            <span className="eyebrow">{`LOCAL FIRST · DESKTOP · ${runtime?.version ?? "…"}`}</span>
            <strong>{t(NAV_ITEMS.find((item) => item.id === page)?.label ?? "首页")}</strong>
          </div>
          <div className="topbar-actions">
            <DesktopLanguageControls />
            <button className="ghost-button" onClick={refreshLibrary}>{t("刷新资料")}</button>
            <button className="ghost-button" onClick={() => navigate("settings")}>{t("实例设置")}</button>
          </div>
        </header>

        <div className="status-line">{message}</div>

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
