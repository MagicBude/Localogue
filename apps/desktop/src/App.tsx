import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { MediaScanCoordinator } from "@/application/media/media-scan-coordinator";
import { findApprovedGenreAlias } from "@/application/services/genre-localization-service";
import { localizeText } from "@/application/services/localization-service";
import type { Asset } from "@/domain/entities/asset";
import type { MediaFile } from "@/domain/entities/media-file";
import type { MediaScanJobSnapshot } from "@/domain/entities/media-scan";

import type {
  DesktopBootstrapSettings,
  DesktopMediaProbeResult,
  DesktopRuntimeInfo,
  DesktopSharedPackInfo,
  DesktopTaskProgress,
} from "./contracts";
import {
  TauriFileDialogAdapter,
  TauriFileHashAdapter,
  TauriFileOpenerAdapter,
  TauriFileSystemAdapter,
  TauriMediaProbeAdapter,
  tauriDesktopCapabilities,
} from "./platform/tauri-platform-adapters";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { desktopBridge } from "./tauri-bridge";
import { DesktopAssetStorageGovernance } from "./desktop-asset-storage-governance";
import { DesktopWorkExplorer } from "./desktop-work-explorer";
import { DesktopCatalogBrowser } from "./desktop-catalog-browser";
import { DesktopGovernance } from "./desktop-governance";
import { DesktopPortablePackWorkbench } from "./desktop-portable-pack-workbench";
import { DesktopLanguageControls, useDesktopI18n } from "./desktop-i18n";
import {
  importLocalAssetPreview,
  previewLocalAssetImport,
  type LocalAssetImportPreview,
  type LocalAssetImportResult,
} from "./local-asset-import";
import {
  MediaBindingPanel,
} from "./desktop-management";
import { DesktopWorkDetailPage, DesktopWorksPage } from "./desktop-work-pages";
import { DesktopPeoplePage, DesktopPersonDetailPage } from "./desktop-person-pages";
import { DesktopHomePage } from "./desktop-home-page";
import {
  importNfoPreview,
  previewNfoImport,
  saveNfoPreviewAsEvidence,
  type NfoImportPreview,
  type NfoImportResult,
  type NfoImportItemStatus,
} from "./nfo-library-import";
import { applyVocabularyRepair, previewVocabularyRepair, type VocabularyRepairPreview, type VocabularyRepairResult } from "./vocabulary-repair";
import { useStableAsyncData } from "./use-stable-async-data";
import {
  activeLibraryProfile,
  addLibraryProfile,
  applyLibraryProfile,
  createEmptyLibraryProfile,
  createLibraryProfile,
  createLibraryProfileId,
  ensureLibraryProfiles,
  hasUnsavedLibraryPaths,
  isDevFixtureLibraryPath,
  nextLibraryProfileName,
  removeLibraryProfile,
  renameLibraryProfile,
  syncActiveLibraryProfile,
} from "./library-profiles";

const fileDialog = new TauriFileDialogAdapter();
const fileOpener = new TauriFileOpenerAdapter();
const mediaProbe = new TauriMediaProbeAdapter();
const fileSystem = new TauriFileSystemAdapter();
const fileHash = new TauriFileHashAdapter();

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
          <MediaPage
            repository={repository}
            settings={savedSettings}
            setMessage={setMessage}
            progress={progress}
            onLibraryChanged={refreshLibrary}
            runtimeContractRevision={runtime?.contractRevision ?? 0}
          />
        ) : page === "packs" ? (
          <PacksPage
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
          <SettingsPage
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

function MediaPage({
  repository,
  settings,
  setMessage,
  progress,
  onLibraryChanged,
  runtimeContractRevision,
}: {
  repository: TauriLibraryRepository;
  settings: DesktopBootstrapSettings;
  setMessage: (message: string) => void;
  progress: DesktopTaskProgress | null;
  onLibraryChanged: () => void;
  runtimeContractRevision: number;
}) {
  const { t, metadataLanguage } = useDesktopI18n();
  const [scan, setScan] = useState<MediaScanJobSnapshot | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [probe, setProbe] = useState<DesktopMediaProbeResult | null>(null);
  const [probing, setProbing] = useState(false);
  const [nfoPreview, setNfoPreview] = useState<NfoImportPreview | null>(null);
  const [nfoResult, setNfoResult] = useState<NfoImportResult | null>(null);
  const [assetPreview, setAssetPreview] = useState<LocalAssetImportPreview | null>(null);
  const [assetResult, setAssetResult] = useState<LocalAssetImportResult | null>(null);
  const [metadataBusy, setMetadataBusy] = useState(false);
  const [bindingMediaId, setBindingMediaId] = useState<string | null>(null);
  const [vocabularyPreview, setVocabularyPreview] = useState<VocabularyRepairPreview | null>(null);
  const [vocabularyResult, setVocabularyResult] = useState<VocabularyRepairResult | null>(null);
  const [vocabularyBusy, setVocabularyBusy] = useState(false);
  const scanCoordinator = useRef<MediaScanCoordinator | null>(null);
  const scanTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (scanTimer.current !== null) window.clearInterval(scanTimer.current);
  }, []);

  const mediaRoots = effectiveMediaRoots(settings);
  const nfoRoots = effectiveNfoRoots(settings);
  const assetRoots = effectiveAssetRoots(settings);

  const data = useAsyncData(async () => {
    const [media, works, assets] = await Promise.all([
      repository.listMediaFiles(),
      repository.listWorks({ page: 1, pageSize: 100000 }),
      repository.listAssets(),
    ]);
    return { media, works: new Map(works.items.map((item) => [item.id, item])), assets };
  }, [repository]);

  async function startScan(options: { waitForCompletion?: boolean } = {}): Promise<MediaScanJobSnapshot | null> {
    if (!settings.libraryPath) {
      setMessage(t("请先在设置页选择 Private Library。Shared Pack 不能保存 MediaFile。"));
      return null;
    }
    if (!mediaRoots.length) {
      setMessage(t("请先添加 Unified Library Root，或在高级设置里添加媒体扫描目录。"));
      return null;
    }

    try {
      const platform = {
        fileSystem,
        fileHash,
        mediaProbe,
        fileDialog,
        fileOpener,
        capabilities: tauriDesktopCapabilities,
      };
      const coordinator = new MediaScanCoordinator(repository, platform);
      scanCoordinator.current = coordinator;
      const initial = coordinator.start({
        roots: mediaRoots,
        ffprobeExecutable: settings.ffprobePath?.trim() || "ffprobe",
        probeMedia: true,
        computeSha256: false,
        pruneMissing: true,
        // Unified Root 按文件扩展名分流：任何子目录中的视频都会被发现；图片由 Local Asset Ingest 单独处理，避免图片文件占用媒体发现上限。
        observeImageSidecars: false,
      });
      setScan(initial);
      setMessage(t("Desktop 增量媒体扫描已启动：将依次检查全部 {count} 个媒体根目录。", { count: mediaRoots.length }));

      if (scanTimer.current !== null) window.clearInterval(scanTimer.current);

      if (options.waitForCompletion) {
        scanTimer.current = window.setInterval(() => {
          setScan(coordinator.getSnapshot());
        }, 250);
        const final = await coordinator.waitForCompletion();
        if (scanTimer.current !== null) window.clearInterval(scanTimer.current);
        scanTimer.current = null;
        setScan(final);
        onLibraryChanged();
        if (final?.status === "completed") {
          setMessage(t("媒体扫描完成：已检查 {roots} 个目录，发现 {files} 个视频。", { roots: final.result?.roots.length ?? 0, files: final.result?.discovered ?? 0 }));
        } else {
          setMessage(final?.progress.message ?? t("媒体扫描已结束。"));
        }
        return final;
      }

      scanTimer.current = window.setInterval(() => {
        const snapshot = coordinator.getSnapshot();
        setScan(snapshot);
        if (snapshot && !["running", "cancelling"].includes(snapshot.status)) {
          if (scanTimer.current !== null) window.clearInterval(scanTimer.current);
          scanTimer.current = null;
          onLibraryChanged();
          setMessage(
            snapshot.status === "completed"
              ? t("媒体扫描完成：已检查 {roots} 个目录，发现 {files} 个视频。", { roots: snapshot.result?.roots.length ?? 0, files: snapshot.result?.discovered ?? 0 })
              : snapshot.progress.message ?? t("媒体扫描已结束。"),
          );
        }
      }, 250);
      return initial;
    } catch (error) {
      if (scanTimer.current !== null) window.clearInterval(scanTimer.current);
      scanTimer.current = null;
      setMessage(t("无法启动扫描：{error}", { error: toMessage(error) }));
      return null;
    }
  }

  async function scanMetadataSource(): Promise<void> {
    if (!settings.libraryPath) {
      setMessage(t("请先在设置页选择 Private Library；NFO 与本地 Asset 导入都会写入私人资料库。"));
      return;
    }
    if (!nfoRoots.length && !assetRoots.length) {
      setMessage(t("请先添加 Unified Library Root，或配置高级 NFO / Media 扫描路径。"));
      return;
    }

    setMetadataBusy(true);
    setNfoResult(null);
    setAssetResult(null);
    try {
      const nfo = await previewNfoImport(nfoRoots, repository);
      const assets = await previewLocalAssetImport(assetRoots, repository, nfo);
      setNfoPreview(nfo);
      setAssetPreview(assets);
      setMessage(t("资料源扫描完成：发现 {nfo} 个 NFO（{works} 个 Work 候选）和 {images} 张图片（{linkable} 张可关联）。", { nfo: nfo.discovered, works: nfo.importable, images: assets.discovered, linkable: assets.linkable }));
    } catch (error) {
      setMessage(t("资料源扫描失败：{error}", { error: toMessage(error) }));
    } finally {
      setMetadataBusy(false);
    }
  }

  async function saveMetadataAsEvidence(): Promise<void> {
    if (!nfoPreview?.importable) {
      setMessage("当前预览没有可保存为 Evidence 的 NFO Work 候选。");
      return;
    }
    setMetadataBusy(true);
    try {
      const count = await saveNfoPreviewAsEvidence(nfoPreview);
      setMessage(`已保存 ${count} 条不可变 NFO Evidence；可前往“审核”生成 Commit Plan。`);
    } catch (error) {
      setMessage(`保存 Evidence 失败：${toMessage(error)}`);
    } finally {
      setMetadataBusy(false);
    }
  }

  async function importMetadataSource(): Promise<void> {
    if (!nfoPreview && !assetPreview) return;
    setMetadataBusy(true);
    try {
      let nfo: NfoImportResult | null = null;
      let assets: LocalAssetImportResult | null = null;
      if (nfoPreview?.importable) {
        nfo = await importNfoPreview(nfoPreview, repository, (value) => fileHash.sha256Text(value));
        setNfoResult(nfo);
      }
      if (assetPreview?.linkable) {
        // Asset Import 会在真正写入时重新按番号查 Work，因此同一次操作里刚由 NFO 创建的 Work 也能立即接住 poster/fanart/thumb。
        assets = await importLocalAssetPreview(assetPreview, repository, (value) => fileHash.sha256Text(value));
        setAssetResult(assets);
      }
      onLibraryChanged();
      setMessage(t("资料导入完成：NFO {nfo}；图片 {assets}。之后可运行媒体扫描按番号关联视频。", { nfo: nfo ? `${nfo.createdWorks} new / ${nfo.updatedWorks} updated` : "—", assets: assets ? `${assets.imported} linked / ${assets.createdAssets} assets` : "—" }));
    } catch (error) {
      setMessage(t("资料导入失败：{error}", { error: toMessage(error) }));
    } finally {
      setMetadataBusy(false);
    }
  }

  async function syncUnifiedLibrary(): Promise<void> {
    if (!settings.libraryPath) {
      setMessage(t("请先在设置页选择 Private Library；统一同步需要写入 Work / Asset / MediaFile。"));
      return;
    }
    if (!unique([...nfoRoots, ...assetRoots, ...mediaRoots]).length) {
      setMessage(t("请先添加 Unified Library Root，或配置高级扫描路径。"));
      return;
    }
    if (metadataBusy || scan?.status === "running" || scan?.status === "cancelling") return;

    setMetadataBusy(true);
    setNfoResult(null);
    setAssetResult(null);
    try {
      setMessage(t("统一资料库同步：正在发现 NFO 与本地图片…"));
      const nfoPreviewNext = await previewNfoImport(nfoRoots, repository);
      setNfoPreview(nfoPreviewNext);

      let nfo: NfoImportResult | null = null;
      if (nfoPreviewNext.importable) {
        nfo = await importNfoPreview(nfoPreviewNext, repository, (value) => fileHash.sha256Text(value));
        setNfoResult(nfo);
      }

      // NFO 可能刚创建 Work；因此图片 Preview 故意放在 NFO Import 之后重新计算，
      // 让同一次“一键同步”里的 poster / cover 直接看到最新 Canonical Work。
      const assetPreviewNext = await previewLocalAssetImport(assetRoots, repository, nfoPreviewNext);
      setAssetPreview(assetPreviewNext);
      let assets: LocalAssetImportResult | null = null;
      if (assetPreviewNext.linkable) {
        assets = await importLocalAssetPreview(assetPreviewNext, repository, (value) => fileHash.sha256Text(value));
        setAssetResult(assets);
      }

      onLibraryChanged();
      setMessage(t("元数据与图片已同步：NFO {nfo}；图片 {assets}。正在继续启动媒体增量扫描…", { nfo: nfo ? `${nfo.imported} / +${nfo.createdWorks} Work` : "—", assets: assets ? `${assets.imported} / +${assets.createdAssets} Asset` : `${assetPreviewNext.discovered} / ${assetPreviewNext.linkable} linkable` }));
    } catch (error) {
      setMessage(t("统一资料库同步失败：{error}", { error: toMessage(error) }));
      return;
    } finally {
      setMetadataBusy(false);
    }

    const media = await startScan({ waitForCompletion: true });
    if (media?.status === "completed") {
      setMessage(t("统一资料库同步完成：全部 {roots} 个媒体目录均已检查，发现 {files} 个视频。", { roots: media.result?.roots.length ?? 0, files: media.result?.discovered ?? 0 }));
    }
  }

  async function auditVocabulary(): Promise<void> {
    setVocabularyBusy(true);
    setVocabularyResult(null);
    try {
      const preview = await previewVocabularyRepair(repository);
      setVocabularyPreview(preview);
      setMessage(t("分类审计完成：{works} 个 Work 需要修复；{unmapped} 个来源词保持 unmapped。", { works: preview.affectedWorks, unmapped: preview.unmappedTerms.length }));
    } catch (error) {
      setMessage(t("分类审计失败：{error}", { error: toMessage(error) }));
    } finally {
      setVocabularyBusy(false);
    }
  }

  async function repairVocabulary(): Promise<void> {
    if (!vocabularyPreview?.affectedWorks) return;
    if (!window.confirm(t("应用分类修复？只重排 V1-16/17 NFO 自动生成的 Genre / Tag 引用，不会删除用户手工 Tag。"))) return;
    setVocabularyBusy(true);
    try {
      const result = await applyVocabularyRepair(repository, vocabularyPreview, (value) => fileHash.sha256Text(value));
      setVocabularyResult(result);
      setVocabularyPreview(await previewVocabularyRepair(repository));
      onLibraryChanged();
      setMessage(t("分类修复完成：更新 {works} 个 Work；新建 Series {series}；新建 Genre {genres}。", { works: result.updatedWorks, series: result.createdSeries, genres: result.createdGenres }));
    } catch (error) {
      setMessage(t("分类修复失败：{error}", { error: toMessage(error) }));
    } finally {
      setVocabularyBusy(false);
    }
  }

  async function chooseAndProbe(): Promise<void> {
    const path = await fileDialog.pickFile();
    if (!path) return;
    setSelectedPath(path);
    setProbe(null);
    setProbing(true);
    try {
      setProbe(await mediaProbe.probe(settings.ffprobePath || "ffprobe", path));
      setMessage(t("ffprobe Native Command 执行成功。"));
    } catch (error) {
      setMessage(t("ffprobe 失败：{error}", { error: toMessage(error) }));
    } finally {
      setProbing(false);
    }
  }

  return (
    <div className="page-stack">
      <PageTitle eyebrow="LOCAL · MEDIA · METADATA · ASSET" title={t("本地资料")} description={t("一个 Unified Library Root 可以同时发现视频、NFO、poster / fanart / thumb；它们最终按 Work 番号汇聚，而不依赖同目录。")} />
      <section className="settings-card unified-sync-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ONE ROOT · ONE ACTION</span>
            <h2>{t("一键同步 Unified Library")}</h2>
            <p className="muted">{t("按固定顺序执行 NFO → poster / cover / fanart / thumb → Media。这样不会再出现“视频已经扫描，但 Work / Asset 还没导入”的半同步状态。")}</p>
          </div>
          <button className="primary-button sync-library-button" disabled={metadataBusy || scan?.status === "running" || scan?.status === "cancelling"} onClick={() => void syncUnifiedLibrary()}>
            {metadataBusy || scan?.status === "running" ? t("同步中…") : t("同步资料库")}
          </button>
        </div>
        <code className="path-block">{unique([...settings.libraryRoots]).length ? unique([...settings.libraryRoots]).join("\n") : t("尚未配置 Unified Library Root；仍可使用下方高级媒体 / NFO 路径。")}</code>
      </section>
      <section className="settings-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">INCREMENTAL MEDIA SCAN</span>
            <h2>{t("媒体扫描")}</h2>
            <p className="muted">{t("递归扫描 Unified Roots + 高级媒体路径。未变化文件继续走 V1-12 Fast Path。")}</p>
          </div>
          <div className="button-row">
            <button className="primary-button" disabled={scan?.status === "running" || scan?.status === "cancelling"} onClick={() => void startScan()}>{t("仅扫描视频")}</button>
            <button disabled={scan?.status !== "running"} onClick={() => setScan(scanCoordinator.current?.cancel() ?? null)}>{t("取消")}</button>
          </div>
        </div>
        <code className="path-block">{mediaRoots.length ? mediaRoots.join("\n") : t("尚未配置可扫描资料根目录")}</code>
        {scan ? <div className={`progress ${scan.status}`}><strong>{scan.status} · {scan.progress.phase}</strong><span>{scan.progress.message}</span><span>{scan.progress.current} / {scan.progress.total}</span></div> : null}
        {scan?.result ? <>
          <div className="mini-stat-grid">
            <MiniStat label={t("扫描目录")} value={scan.result.roots.length} />
            <MiniStat label={t("已发现")} value={scan.result.discovered} />
            <MiniStat label={t("新增")} value={scan.result.added} />
            <MiniStat label={t("已更新")} value={scan.result.updated} />
            <MiniStat label={t("未变化")} value={scan.result.unchanged} />
            <MiniStat label={t("已移除")} value={scan.result.removed} />
          </div>
          <details className="scan-root-report">
            <summary>{t("本轮实际扫描的 {count} 个目录", { count: scan.result.roots.length })}</summary>
            <code className="path-block">{scan.result.roots.join("\n")}</code>
          </details>
          {scan.result.warnings.length ? <details><summary>{t("{count} 条媒体扫描警告", { count: scan.result.warnings.length })}</summary><ul>{scan.result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
        </> : null}
      </section>

      <section className="settings-card table-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">UNIFIED METADATA SOURCE</span>
            <h2>{t("NFO + 本地图片")}</h2>
            <p className="muted">{t("推荐只配置一个大目录。Desktop 会递归发现子目录中的 NFO、poster、fanart、thumb，再按番号或同 stem 汇聚到同一个 Work；原始图片不会移动。")}</p>
          </div>
          <div className="button-row">
            <button disabled={metadataBusy} onClick={() => void scanMetadataSource()}>{metadataBusy ? t("处理中…") : t("预览 NFO + 图片")}</button>
            <button disabled={metadataBusy || !nfoPreview?.importable} onClick={() => void saveMetadataAsEvidence()}>保存为 Evidence</button>
            <button className="primary-button" disabled={metadataBusy || !(nfoPreview?.importable || assetPreview?.linkable)} onClick={() => void importMetadataSource()}>{t("导入当前预览")}</button>
          </div>
        </div>
        <code className="path-block">{unique([...nfoRoots, ...assetRoots]).length ? unique([...nfoRoots, ...assetRoots]).join("\n") : t("尚未配置 Unified Library Root / 兼容扫描路径")}</code>

        {nfoPreview ? <>
          <SectionTitle eyebrow="NFO GROUPS" title={t("NFO 作品组")} />
          <div className="mini-stat-grid">
            <MiniStat label={t("NFO 文件")} value={nfoPreview.discovered} />
            <MiniStat label={t("Work 候选")} value={nfoPreview.importable} />
            <MiniStat label={t("新 Work")} value={nfoPreview.newWorks} />
            <MiniStat label={t("已有 Work")} value={nfoPreview.existingWorks} />
            <MiniStat label={t("跳过文件")} value={nfoPreview.skipped + nfoPreview.errors} />
          </div>
          <div className="table-wrap nfo-preview-table"><table className="data-table"><thead><tr><th>{t("作品组 / NFO 来源")}</th><th>{t("番号")}</th><th>{t("标题")}</th><th>{t("状态")}</th></tr></thead><tbody>
            {nfoPreview.groups.slice(0, 100).map((group) => <tr key={group.key}>
              <td>
                <strong>{group.sourceCount > 1 ? t("{count} 个 NFO 来源", { count: group.sourceCount }) : group.representative.fileName}</strong>
                {group.sourceCount > 1 ? <details><summary>{t("查看文件")}</summary><small className="path-text">{group.sources.map((item) => item.fileName).join("\n")}</small></details> : <small className="path-text">{group.representative.path}</small>}
              </td>
              <td>{group.code ?? "—"}</td>
              <td>{group.title ?? group.representative.error ?? "—"}{group.representative.unmappedTerms?.length ? <small className="path-text">{t("Unmapped 来源词")}: {group.representative.unmappedTerms.length}</small> : null}</td>
              <td><span className={nfoStatusClass(group.status)}>{nfoStatusLabel(group.status, t)}{group.sourceCount > 1 ? ` · ${t("{count} 个 NFO 来源", { count: group.sourceCount })}` : ""}</span></td>
            </tr>)}
          </tbody></table></div>
          {nfoPreview.groups.length > 100 ? <p className="muted">{t("NFO 预览只显示前 100 个作品组；导入会处理全部 {count} 个可识别 Work 候选。", { count: nfoPreview.importable })}</p> : null}
        </> : <p className="muted">{t("多段 NFO（例如 MDVR-195.part1～part6）会聚合成一个 Work 组，不再把其余文件显示成一长串“重复番号”。")}</p>}

        {assetPreview ? <>
          <SectionTitle eyebrow="LOCAL ASSET CANDIDATES" title={t("本地图片资产")} />
          <div className="mini-stat-grid">
            <MiniStat label={t("图片")} value={assetPreview.discovered} />
            <MiniStat label={t("可关联")} value={assetPreview.linkable} />
            <MiniStat label={t("等待 Work")} value={assetPreview.pendingWork} />
            <MiniStat label={t("跳过")} value={assetPreview.skipped} />
          </div>
          <div className="table-wrap"><table className="data-table"><thead><tr><th>{t("图片")}</th><th>{t("番号")}</th><th>{t("类型")}</th><th>{t("匹配")}</th><th>{t("状态")}</th></tr></thead><tbody>
            {assetPreview.items.slice(0, 100).map((item) => <tr key={item.path}>
              <td><strong>{item.fileName}</strong><small className="path-text">{item.path}</small></td>
              <td>{item.code ?? "—"}</td>
              <td>{item.type ?? "—"}</td>
              <td>{item.matchedBy === "nfo-stem" ? t("同 NFO stem") : item.matchedBy === "filename-code" ? t("文件名番号") : "—"}</td>
              <td><span className={assetStatusClass(item.status)}>{assetStatusLabel(item.status, t)}</span></td>
            </tr>)}
          </tbody></table></div>
          {assetPreview.items.length > 100 ? <p className="muted">{t("图片预览只显示前 100 条；实际导入会处理全部 {count} 张可关联图片。", { count: assetPreview.linkable })}</p> : null}
        </> : null}

        {nfoResult ? <p className="success-message">{t("NFO：导入 {imported} · 新建 Work {works} · 更新 {updated} · 新建 Person {people} · 新建 Organization {organizations}", { imported: nfoResult.imported, works: nfoResult.createdWorks, updated: nfoResult.updatedWorks, people: nfoResult.createdPeople, organizations: nfoResult.createdOrganizations })}</p> : null}
        {assetResult ? <p className="success-message">{t("图片：关联 {imported} · 新建 Asset {created} · 复用 {reused} · 更新 Work {works}", { imported: assetResult.imported, created: assetResult.createdAssets, reused: assetResult.reusedAssets, works: assetResult.updatedWorks })}</p> : null}
        {nfoResult?.warnings.length ? <details><summary>{t("{count} 条 NFO 导入警告", { count: nfoResult.warnings.length })}</summary><ul>{nfoResult.warnings.slice(0, 50).map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
        {assetResult?.warnings.length ? <details><summary>{t("{count} 条 Asset 导入警告", { count: assetResult.warnings.length })}</summary><ul>{assetResult.warnings.slice(0, 50).map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
      </section>

      <section className="settings-card vocabulary-audit-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">VOCABULARY AUDIT</span>
            <h2>{t("分类词表审计")}</h2>
            <p className="muted">{t("检查早期 NFO 导入把“系列: … / 单体作品 / イメージビデオ”等混入 Genre / Tag 的情况。先预览，再显式修复；用户手工 Tag 不会被删除。")}</p>
          </div>
          <div className="button-row">
            <button disabled={vocabularyBusy} onClick={() => void auditVocabulary()}>{vocabularyBusy ? t("处理中…") : t("检查分类")}</button>
            <button className="primary-button" disabled={vocabularyBusy || !vocabularyPreview?.affectedWorks} onClick={() => void repairVocabulary()}>{t("应用修复")}</button>
          </div>
        </div>
        {vocabularyPreview ? <>
          <div className="mini-stat-grid">
            <MiniStat label={t("扫描 Work")} value={vocabularyPreview.scannedWorks} />
            <MiniStat label={t("需要修复")} value={vocabularyPreview.affectedWorks} />
            <MiniStat label={t("移入 Series")} value={vocabularyPreview.movedToSeries} />
            <MiniStat label={t("移入作品类型")} value={vocabularyPreview.movedToWorkTypes} />
            <MiniStat label={t("移入 Genre")} value={vocabularyPreview.movedToGenres} />
            <MiniStat label={t("Unmapped 来源词")} value={vocabularyPreview.unmappedTerms.length} />
          </div>
          {vocabularyPreview.unmappedTerms.length ? <details><summary>{t("查看 unmapped 来源词（不会自动进入 Canonical）")}</summary><div className="token-list vocabulary-unmapped-list">{vocabularyPreview.unmappedTerms.slice(0, 200).map((term) => {
            const reference = findApprovedGenreAlias(term);
            const localized = reference ? (metadataLanguage === "zh-CN" ? reference["zh-CN"] : metadataLanguage === "en" ? reference.en : reference.ja) : undefined;
            return <code key={term} title={reference ? `${reference.sources.join(" / ")} · ${reference.note ?? "approved genre alias"}` : undefined}>{localized && localized !== term ? `${term} → ${localized}` : term}{reference ? ` · ${t("词表参考")}` : ""}</code>;
          })}</div></details> : null}
          <p className="muted">{t("将移除 {genres} 个早期 NFO Genre 引用和 {tags} 个早期 NFO Tag 引用，再按映射表重新分流。", { genres: vocabularyPreview.removedImportedGenres, tags: vocabularyPreview.removedImportedTags })}</p>
        </> : <p className="muted">{t("尚未执行分类审计。这个工具专门修复早期 Desktop NFO Bootstrap 产生的分类污染。")}</p>}
        {vocabularyResult ? <p className="success-message">{t("上次修复：更新 {works} 个 Work · 新建 Series {series} · 新建 Genre {genres}", { works: vocabularyResult.updatedWorks, series: vocabularyResult.createdSeries, genres: vocabularyResult.createdGenres })}</p> : null}
      </section>

      <section className="settings-card">
        <div className="section-heading">
          <div><span className="eyebrow">NATIVE PROBE</span><h2>{t("单文件检查")}</h2></div>
          <button onClick={() => void chooseAndProbe()} disabled={probing}>{t("选择 MP4 / MKV…")}</button>
        </div>
        {selectedPath ? <code className="path-block">{selectedPath}</code> : <p className="muted">{t("可选择任意受支持视频验证 ffprobe、打开与定位能力。")}</p>}
        <div className="button-row">
          <button disabled={!selectedPath} onClick={() => void fileOpener.openPath(selectedPath)}>{t("默认播放器打开")}</button>
          <button disabled={!selectedPath} onClick={() => void fileOpener.revealInFolder(selectedPath)}>{t("资源管理器中定位")}</button>
        </div>
        {progress ? <div className={`progress ${progress.stage}`}><strong>{progress.stage}</strong><span>{progress.message}</span></div> : null}
        {probe ? <div className="detail-grid compact-grid">
          <InfoCard label={t("时长")} value={formatDuration(probe.durationSeconds)} />
          <InfoCard label={t("分辨率")} value={probe.width && probe.height ? `${probe.width} × ${probe.height}` : undefined} />
          <InfoCard label={t("视频编码")} value={probe.videoCodec} />
          <InfoCard label={t("音频编码")} value={probe.audioCodec} />
          <InfoCard label={t("封装格式")} value={probe.container} />
        </div> : null}
      </section>

      {data.loading ? <LoadingState /> : data.error || !data.value ? <ErrorState error={data.error} /> : (
        <section className="settings-card table-card">
          <div className="section-heading"><div><span className="eyebrow">PRIVATE LOCAL DATA</span><h2>{data.value.media.length} {t("视频")} · {t("{count} 个资产", { count: data.value.assets.length })}</h2></div></div>
          {data.value.media.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>{t("文件")}</th><th>{t("作品")}</th><th>{t("大小")}</th><th>{t("媒体参数")}</th><th>{t("操作")}</th></tr></thead><tbody>
            {data.value.media.map((file) => {
              const work = file.workId ? data.value!.works.get(file.workId) : undefined;
              return <tr key={file.id}>
                <td><strong>{file.fileName}</strong><small className="path-text">{file.path}</small></td>
                <td>{work ? <><strong>{work.code}</strong><small>{localizeText(work.titles, metadataLanguage)}</small></> : <span className="status-chip warn">{t("未绑定")}</span>}</td>
                <td>{formatBytes(file.fileSize ?? 0)}</td>
                <td>{mediaSummary(file)}</td>
                <td><div className="row-actions"><button onClick={() => void fileOpener.openPath(file.path)}>{t("打开")}</button><button onClick={() => void fileOpener.revealInFolder(file.path)}>{t("定位")}</button><button className={bindingMediaId === file.id ? "primary-button" : ""} onClick={() => setBindingMediaId((current) => current === file.id ? null : file.id)}>{t("管理绑定")}</button></div></td>
              </tr>;
            })}
          </tbody></table></div> : <p className="muted">{t("尚未扫描到本地媒体。")} </p>}
        </section>
      )}

      <DesktopAssetStorageGovernance
        hasPrivateLibrary={Boolean(settings.libraryPath)}
        runtimeContractRevision={runtimeContractRevision}
        setMessage={setMessage}
      />

      {!data.loading && data.value && bindingMediaId ? (() => {
        const target = data.value.media.find((item) => item.id === bindingMediaId);
        return target ? <MediaBindingPanel media={target} repository={repository} setMessage={setMessage} onChanged={() => { setBindingMediaId(null); onLibraryChanged(); }} /> : null;
      })() : null}

    </div>
  );
}

function PacksPage({
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
      <PageTitle eyebrow="SHARED · PRIVATE · PRIORITY" title={t("资料包")} description={t("Shared Pack 在 Desktop 中支持挂载、Native 校验、优先级调整和卸载；内容仍由 Rust Boundary 强制只读。")} />
      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">SOURCE PRIORITY</span><h2>{t("当前资料源优先级")}</h2><p className="muted">{t("Private 永远最高；Shared Pack 顺序决定相同稳定 ID 的读取优先级。")}</p></div><div className="button-row"><button onClick={() => void addPack()}>{t("+ 挂载 Shared Pack")}</button><button className="primary-button" disabled={busy || !hasDraftChanges} onClick={() => void onSave()}>{busy ? t("保存中…") : t("保存资料包配置")}</button></div></div>
        <ol className="source-priority-list">
          {privateLibraryPath ? <li><span className="source-index">1</span><div><strong>Private Library</strong><code>{privateLibraryPath}</code></div><span className="status-chip ok">WRITABLE</span></li> : null}
          {settings.sharedPackPaths.map((path, index) => {
            const pack = packInfos.find((item) => item.configuredPath === path);
            return <li key={path}>
              <span className="source-index">{index + (privateLibraryPath ? 2 : 1)}</span>
              <div><strong>{pack?.name ?? path}</strong><code>{pack?.libraryPath ?? path}</code><small>{pack ? (pack.valid ? `${pack.id} · ${pack.version}${pack.license ? ` · ${pack.license}` : ""}` : pack.error) : t("尚未保存 / 重新校验")}</small></div>
              <div className="pack-actions"><button disabled={index === 0} onClick={() => movePack(index, -1)}>↑</button><button disabled={index === settings.sharedPackPaths.length - 1} onClick={() => movePack(index, 1)}>↓</button><button className="danger-button" onClick={() => removePack(path)}>{t("卸载")}</button></div>
            </li>;
          })}
        </ol>
        {!privateLibraryPath && !settings.sharedPackPaths.length ? <p className="muted">{t("当前没有配置资料源。")} </p> : null}
        {hasDraftChanges ? <p className="status-chip warn">{t("存在未保存的 Shared Pack 变更")}</p> : <p className="status-chip ok">{t("Shared Pack 配置已保存")}</p>}
      </section>
      <DesktopPortablePackWorkbench
        privateLibraryPath={privateLibraryPath}
        profileName={profileName}
        runtimeContractRevision={runtimeContractRevision}
        packInfos={packInfos}
        onSharedInstalled={onSharedInstalled}
        onPrivateImported={onPrivateImported}
        setMessage={setMessage}
      />
      <section className="settings-card soft-card">
        <span className="eyebrow">NATIVE READ-ONLY BOUNDARY</span>
        <h2>{t("Shared Pack 不会被 Desktop CRUD 修改")}</h2>
        <p>{t("编辑 Shared Work / Person 时，Desktop 会在 Private Library 写入同 ID Override；删除也只删除 Private Override。Shared Pack 本身不会通过 Canonical Writer 被修改。")}</p>
        <button onClick={onOpenSettings}>{t("打开完整实例设置")}</button>
      </section>
    </div>
  );
}

function SettingsPage({
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



function sortWorkAssets(assets: Asset[]): Asset[] {
  const rank: Record<string, number> = {
    poster: 0,
    fanart: 1,
    screenshot: 2,
    cover: 3,
    portrait: 4,
    gallery: 5,
    logo: 6,
    subtitle: 7,
    document: 8,
    other: 9,
  };
  return [...assets].sort((a, b) => (rank[a.type] ?? 99) - (rank[b.type] ?? 99) || a.storagePath.localeCompare(b.storagePath, "en"));
}

function nfoStatusLabel(status: NfoImportItemStatus, t: (source: string) => string): string {
  switch (status) {
    case "new_work": return t("新 Work");
    case "existing_work": return t("补充已有 Work");
    case "missing_code": return t("缺少番号");
    case "missing_title": return t("缺少标题");
    case "duplicate_code": return t("重复番号");
    case "parse_error": return t("解析失败");
  }
}

function nfoStatusClass(status: NfoImportItemStatus): string {
  return status === "new_work" || status === "existing_work" ? "status-chip ok" : "status-chip warn";
}

function assetStatusLabel(status: LocalAssetImportPreview["items"][number]["status"], t: (source: string) => string): string {
  switch (status) {
    case "ready": return t("可关联");
    case "pending_work": return t("等待本轮 NFO 创建 Work");
    case "missing_code": return t("缺少番号");
    case "work_not_found": return t("找不到 Work");
    case "unknown_asset_type": return t("未识别图片角色");
  }
}

function assetStatusClass(status: LocalAssetImportPreview["items"][number]["status"]): string {
  return status === "ready" || status === "pending_work" ? "status-chip ok" : "status-chip warn";
}

function effectiveMediaRoots(settings: DesktopBootstrapSettings): string[] {
  return unique([...settings.libraryRoots, ...settings.mediaScanPaths]);
}

function effectiveNfoRoots(settings: DesktopBootstrapSettings): string[] {
  return unique([...settings.libraryRoots, ...settings.nfoScanPaths]);
}

function effectiveAssetRoots(settings: DesktopBootstrapSettings): string[] {
  // 兼容 V1-16：旧用户即使还没有迁移到 Unified Roots，NFO / Media 专用路径里的图片也会被发现。
  return unique([...settings.libraryRoots, ...settings.nfoScanPaths, ...settings.mediaScanPaths]);
}

function PathList({ values, onRemove }: { values: string[]; onRemove: (value: string) => void }) {
  const { t } = useDesktopI18n();
  if (!values.length) return <p className="muted">{t("尚未配置。")} </p>;
  return <ul className="path-list">{values.map((path) => <li key={path}><code>{path}</code><button className="danger-button" onClick={() => onRemove(path)}>{t("移除")}</button></li>)}</ul>;
}

function TokenList({ values }: { values: string[] }) {
  const { t } = useDesktopI18n();
  if (!values.length) return <p className="muted">{t("暂无分类引用。")} </p>;
  return <div className="token-list">{values.map((value) => <code key={value}>{value}</code>)}</div>;
}

function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></section>;
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="section-title"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>;
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return <article className="stat-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function InfoCard({ label, value }: { label: string; value?: string }) {
  return <article className="info-card"><span>{label}</span><strong>{value && value !== "—" ? value : "—"}</strong></article>;
}

function LoadingState() {
  const { t } = useDesktopI18n();
  return <section className="empty-state"><div className="loading-dot" /><strong>{t("正在读取资料库…")}</strong></section>;
}

function ErrorState({ error }: { error: unknown }) {
  const { t } = useDesktopI18n();
  return <section className="empty-state error-state"><span className="eyebrow">READ ERROR</span><h2>{t("无法读取当前页面")}</h2><p>{toMessage(error)}</p></section>;
}

function EmptyResults() {
  const { t } = useDesktopI18n();
  return <section className="empty-state"><strong>{t("没有符合当前条件的数据。")}</strong></section>;
}

function useAsyncData<T>(factory: () => Promise<T>, dependencies: readonly unknown[]) {
  return useStableAsyncData(factory, dependencies);
}


function mediaSummary(file: MediaFile): ReactNode {
  const resolution = file.width && file.height ? `${file.width}×${file.height}` : null;
  const codecs = [file.container, file.videoCodec, file.audioCodec].filter(Boolean).join(" · ");
  return <><strong>{resolution ?? "—"}</strong><small>{codecs || (file.analysisStale ? "analysis stale" : "—")}</small></>;
}

function formatDuration(value?: number): string | undefined {
  if (!value || !Number.isFinite(value)) return undefined;
  const total = Math.round(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatBytes(value: number): string {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 2 ? 2 : 1)} ${units[index]}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function invalidPackInfo(path: string, error: unknown): DesktopSharedPackInfo {
  return {
    configuredPath: path,
    absolutePath: path,
    valid: false,
    error: toMessage(error),
  };
}

function toMessage(error: unknown): string {
  if (error === undefined || error === null) return "未知错误";
  return error instanceof Error ? error.message : String(error);
}
