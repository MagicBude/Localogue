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
import {
  getPreferredPersonName,
  localizeText,
} from "@/application/services/localization-service";
import type { Asset } from "@/domain/entities/asset";
import type { MediaFile } from "@/domain/entities/media-file";
import type { MediaScanJobSnapshot } from "@/domain/entities/media-scan";
import type { Organization } from "@/domain/entities/organization";
import type { Person } from "@/domain/entities/person";
import type { Work } from "@/domain/entities/work";

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
import { DesktopAssetImage } from "./desktop-asset-image";
import {
  buildDesktopWorkCards,
  chooseWorkPoster,
  DesktopWorkResults,
} from "./desktop-work-results";
import { DesktopWorkExplorer } from "./desktop-work-explorer";
import { DesktopPersonCard, DesktopPersonExplorer } from "./desktop-person-explorer";
import { DesktopCatalogBrowser } from "./desktop-catalog-browser";
import { DesktopLanguageControls, useDesktopI18n } from "./desktop-i18n";
import {
  importLocalAssetPreview,
  previewLocalAssetImport,
  type LocalAssetImportPreview,
  type LocalAssetImportResult,
} from "./local-asset-import";
import {
  CreatePersonPanel,
  CreateWorkPanel,
  MediaBindingPanel,
  PersonEditor,
  WorkEditor,
} from "./desktop-management";
import {
  importNfoPreview,
  previewNfoImport,
  type NfoImportPreview,
  type NfoImportResult,
  type NfoImportItemStatus,
} from "./nfo-library-import";

const fileDialog = new TauriFileDialogAdapter();
const fileOpener = new TauriFileOpenerAdapter();
const mediaProbe = new TauriMediaProbeAdapter();
const fileSystem = new TauriFileSystemAdapter();
const fileHash = new TauriFileHashAdapter();

const DEFAULT_SETTINGS: DesktopBootstrapSettings = {
  schemaVersion: 1,
  libraryRoots: [],
  mediaScanPaths: [],
  nfoScanPaths: [],
  sharedPackPaths: [],
  webUrl: "http://127.0.0.1:3000",
};

type DesktopPage = "home" | "works" | "people" | "browse" | "media" | "packs" | "settings";
type DetailTarget = { kind: "work" | "person"; id: string } | null;

const NAV_ITEMS: Array<{ id: DesktopPage; label: string; eyebrow: string; short: string }> = [
  { id: "home", label: "首页", eyebrow: "HOME", short: "HM" },
  { id: "works", label: "作品", eyebrow: "WORKS", short: "WK" },
  { id: "people", label: "人物", eyebrow: "PEOPLE", short: "PP" },
  { id: "browse", label: "浏览", eyebrow: "BROWSE", short: "BR" },
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
        setRuntime(runtimeInfo);
        setSettings(saved);
        setSavedSettings(saved);
        await refreshSources(saved);
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

  async function saveSettings(): Promise<void> {
    setBusy(true);
    try {
      const saved = await desktopBridge.saveSettings(settings);
      setSettings(saved);
      setSavedSettings(saved);
      await refreshSources(saved);
      setMessage(t("Desktop 实例设置已保存；Unified Library Roots、兼容扫描路径与 Shared Packs 已重新加载。"));
    } catch (error) {
      setMessage(t("保存失败：{error}", { error: toMessage(error) }));
    } finally {
      setBusy(false);
    }
  }

  const hasLibrarySource = readRoots.length > 0;

  return (
    <div className={sidebarCollapsed ? "desktop-layout is-sidebar-collapsed" : "desktop-layout"}>
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("home")}>
          <span className="brand-mark">L</span>
          <span className="brand-copy">
            <strong>Localogue</strong>
            <small>Desktop · V1-20</small>
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
          <span className="eyebrow">{t("资料源")}</span>
          <strong>{readRoots.length}</strong>
          <small>
            {savedSettings.libraryPath
              ? t("Private + {count} Shared", { count: packInfos.filter((item) => item.valid).length })
              : t("{count} Shared", { count: packInfos.filter((item) => item.valid).length })}
          </small>
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
            <span className="eyebrow">DESKTOP UX · I18N · PRESENTATION · V1-20</span>
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
          <HomePage repository={repository} openWork={openWork} openPerson={openPerson} />
        ) : page === "works" ? (
          detail?.kind === "work" ? (
            <WorkDetailPage
              repository={repository}
              id={detail.id}
              onBack={() => setDetail(null)}
              openPerson={openPerson}
              onLibraryChanged={refreshLibrary}
              setMessage={setMessage}
            />
          ) : (
            <WorksPage repository={repository} openWork={openWork} onLibraryChanged={refreshLibrary} setMessage={setMessage} />
          )
        ) : page === "people" ? (
          detail?.kind === "person" ? (
            <PersonDetailPage
              repository={repository}
              id={detail.id}
              onBack={() => setDetail(null)}
              openWork={openWork}
              onLibraryChanged={refreshLibrary}
              setMessage={setMessage}
            />
          ) : (
            <PeoplePage repository={repository} openPerson={openPerson} onLibraryChanged={refreshLibrary} setMessage={setMessage} />
          )
        ) : page === "browse" ? (
          <DesktopCatalogBrowser repository={repository} openWork={openWork} />
        ) : page === "media" ? (
          <MediaPage
            repository={repository}
            settings={savedSettings}
            setMessage={setMessage}
            progress={progress}
            onLibraryChanged={refreshLibrary}
          />
        ) : page === "packs" ? (
          <PacksPage
            settings={settings}
            setSettings={setSettings}
            privateLibraryPath={savedSettings.libraryPath}
            packInfos={packInfos}
            busy={busy}
            onSave={saveSettings}
            setMessage={setMessage}
            onOpenSettings={() => navigate("settings")}
          />
        ) : (
          <SettingsPage
            runtime={runtime}
            settings={settings}
            setSettings={setSettings}
            busy={busy}
            packInfos={packInfos}
            onSave={() => void saveSettings()}
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

function HomePage({
  repository,
  openWork,
  openPerson,
}: {
  repository: TauriLibraryRepository;
  openWork: (id: string) => void;
  openPerson: (id: string) => void;
}) {
  const { t, metadataLanguage } = useDesktopI18n();
  const data = useAsyncData(async () => {
    const [works, people, organizations, series, media, assets] = await Promise.all([
      repository.listWorks({ page: 1, pageSize: 6, sort: "release_desc" }),
      repository.listPeople({ page: 1, pageSize: 9999, sort: "name_asc" }),
      repository.listOrganizations(),
      repository.listSeries(),
      repository.listMediaFiles(),
      repository.listAssets(),
    ]);
    const performerIds = new Set(
      works.items.flatMap((work) =>
        work.personRelations
          .filter((relation) => relation.role === "performer")
          .map((relation) => relation.personId),
      ),
    );
    const featuredPeople = people.items.filter((person) => performerIds.has(person.id)).slice(0, 6);
    const workCounts = new Map<string, number>();
    for (const work of (await repository.listWorks({ page: 1, pageSize: 100000 })).items) {
      for (const personId of new Set(work.personRelations.filter((relation) => relation.role === "performer").map((relation) => relation.personId))) {
        workCounts.set(personId, (workCounts.get(personId) ?? 0) + 1);
      }
    }
    const portraitByPersonId = new Map<string, Asset>();
    const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
    for (const person of featuredPeople) {
      const portrait = (person.portraitAssetId ? assetsById.get(person.portraitAssetId) : undefined)
        ?? assets.find((asset) => asset.subjectType === "person" && asset.subjectId === person.id && asset.type === "portrait");
      if (portrait) portraitByPersonId.set(person.id, portrait);
    }
    return {
      works,
      people,
      organizations,
      series,
      media,
      featuredPeople,
      workCounts,
      portraitByPersonId,
      recentCards: buildDesktopWorkCards(works.items, people.items, organizations, assets, metadataLanguage),
    };
  }, [repository, metadataLanguage]);

  if (data.loading) return <LoadingState />;
  if (data.error || !data.value) return <ErrorState error={data.error} />;

  const { works, people, organizations, series, media, featuredPeople, recentCards, workCounts, portraitByPersonId } = data.value;
  const workCount = works.total;
  const peopleCount = people.total;

  return (
    <div className="page-stack">
      <section className="hero-panel desktop-hero">
        <span className="eyebrow">LOCAL-FIRST · CURATION · EXPLORATION</span>
        <h1>{t("你的 Localogue，现在就在桌面端。")}</h1>
        <p>{t("V1-20 对齐 Desktop 的布局、资产语义与中 / 日 / 英偏好；浏览、筛选和元数据显示继续共用 Web 的领域规则。")}</p>
      </section>

      <section className="stat-grid">
        <Stat label={t("作品")} value={workCount} note="Canonical" />
        <Stat label={t("人物")} value={peopleCount} note="Canonical" />
        <Stat label={t("厂商")} value={organizations.filter((item) => item.kind === "maker").length} note="Organizations" />
        <Stat label={t("系列")} value={series.length} note="Canonical" />
        <Stat label={t("媒体")} value={media.length} note="Private" />
      </section>

      <SectionTitle eyebrow="RECENT WORKS" title={t("最近作品")} />
      <DesktopWorkResults cards={recentCards} view="grid" onOpen={openWork} />

      {featuredPeople.length ? (
        <>
          <SectionTitle eyebrow="PEOPLE" title={t("相关人物")} />
          <div className="desktop-person-grid desktop-home-people-grid">
            {featuredPeople.map((person) => (
              <DesktopPersonCard
                key={person.id}
                person={person}
                portrait={portraitByPersonId.get(person.id)}
                workCount={workCounts.get(person.id) ?? 0}
                onOpen={() => openPerson(person.id)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function WorksPage({
  repository,
  openWork,
  onLibraryChanged,
  setMessage,
}: {
  repository: TauriLibraryRepository;
  openWork: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
}) {
  const { t } = useDesktopI18n();
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="CANONICAL WORKS · FACETED SEARCH · PRESENTATION PARITY"
        title={t("作品库")}
        description={t("对齐 Web 的多维筛选：演员、导演、年份、作品类型、厂商、厂牌、系列、Genre、Tag、日期、时长、封面与本地媒体，并保留海报墙 / 列表 / 表格三种视图。")}
      />
      <CreateWorkPanel repository={repository} onSaved={(work) => { onLibraryChanged(); openWork(work.id); }} setMessage={setMessage} />
      <DesktopWorkExplorer repository={repository} onOpen={openWork} storageKey="localogue.desktop.work-view" />
    </div>
  );
}

function WorkDetailPage({
  repository,
  id,
  onBack,
  openPerson,
  onLibraryChanged,
  setMessage,
}: {
  repository: TauriLibraryRepository;
  id: string;
  onBack: () => void;
  openPerson: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
}) {
  const { t, metadataLanguage, assetTypeLabel } = useDesktopI18n();
  const data = useAsyncData(async () => {
    const work = await repository.findWorkById(id);
    if (!work) return null;
    const [people, organizations, series, media, assets] = await Promise.all([
      repository.listPeople({ page: 1, pageSize: 99999 }),
      repository.listOrganizations(),
      repository.listSeries(),
      repository.listMediaFiles(work.id),
      repository.listAssetsForSubject("work", work.id),
    ]);
    return {
      work,
      people: new Map(people.items.map((item) => [item.id, item])),
      organizations: new Map(organizations.map((item) => [item.id, item])),
      series: new Map(series.map((item) => [item.id, item])),
      media,
      assets,
    };
  }, [repository, id]);

  if (data.loading) return <LoadingState />;
  if (data.error || !data.value) return data.value === null ? <ErrorState error={t("作品不存在。")} /> : <ErrorState error={data.error} />;
  const { work, people, organizations, series, media, assets } = data.value;
  const poster = chooseWorkPoster(assets);

  const performers = work.personRelations.filter((item) => item.role === "performer");
  const directors = work.personRelations.filter((item) => item.role === "director");

  async function removePrivateAsset(assetId: string, storagePath: string): Promise<void> {
    try {
      const isPrivateAsset = await repository.isPrivateEntity("assets", assetId);
      if (!isPrivateAsset) {
        setMessage(t("该 Asset 来自 Shared Pack，不能直接删除；Shared Pack 始终只读。"));
        return;
      }
      if (!window.confirm(t("从 {code} 解除并删除这个 Private Asset 元数据？\n\n{path}\n\n原始图片与 content-addressed 文件不会由 Desktop 自动物理删除。", { code: work.code, path: storagePath }))) return;
      const nextWork: Work = {
        ...work,
        assetIds: work.assetIds.filter((value) => value !== assetId),
        updatedAt: new Date().toISOString(),
      };
      await repository.saveWork(nextWork);
      try {
        await repository.deletePrivateAsset(assetId);
      } catch (error) {
        await repository.saveWork(work);
        throw error;
      }
      setMessage(t("已从 {code} 解除并删除 Private Asset 元数据；图片文件保留。", { code: work.code }));
      onLibraryChanged();
    } catch (error) {
      setMessage(t("删除 Asset 失败：{error}", { error: toMessage(error) }));
    }
  }

  return (
    <div className="page-stack">
      <button className="back-button" onClick={onBack}>← {t("返回作品库")}</button>
      <section className="detail-hero desktop-work-detail-hero">
        <div className="desktop-work-detail-poster">
          <DesktopAssetImage asset={poster} alt={`${work.code} poster`} fallback={<span className="desktop-poster-placeholder"><b>{work.code}</b></span>} />
        </div>
        <div className="desktop-work-detail-copy">
          <div className="code-badge">{work.code}</div>
          <h1>{localizeText(work.titles, metadataLanguage)}</h1>
          <p>{localizeText(work.descriptions, metadataLanguage, t("暂无简介"))}</p>
        </div>
      </section>
      <WorkEditor
        repository={repository}
        work={work}
        onSaved={onLibraryChanged}
        onDeleted={() => { onLibraryChanged(); onBack(); }}
        setMessage={setMessage}
      />
      <section className="detail-grid">
        <InfoCard label={t("发行日期")} value={work.releaseDate?.value} />
        <InfoCard label={t("时长")} value={work.durationMinutes ? `${work.durationMinutes} ${t("分钟")}` : undefined} />
        <InfoCard label={t("厂商")} value={organizations.get(work.makerId ?? "") ? localizeText(organizations.get(work.makerId ?? "")!.names, metadataLanguage) : undefined} />
        <InfoCard label={t("厂牌")} value={organizations.get(work.labelId ?? "") ? localizeText(organizations.get(work.labelId ?? "")!.names, metadataLanguage) : undefined} />
        <InfoCard label={t("系列")} value={work.seriesIds.map((seriesId) => localizeText(series.get(seriesId)?.names, metadataLanguage)).filter((value) => value !== "—").join(" · ") || undefined} />
        <InfoCard label={t("本地媒体")} value={t("{count} 个文件", { count: media.length })} />
        <InfoCard label={t("本地图片")} value={t("{count} 个资产", { count: assets.length })} />
      </section>
      <DetailPeople title={t("演员")} relations={performers} people={people} onOpen={openPerson} />
      <DetailPeople title={t("导演")} relations={directors} people={people} onOpen={openPerson} />
      <section className="settings-card">
        <span className="eyebrow">LOCAL ASSETS</span>
        <h2>{t("本地图片资产")}</h2>
        {assets.length ? (
          <div className="desktop-asset-gallery">
            {sortWorkAssets(assets).map((asset) => (
              <article className="desktop-asset-card" key={asset.id}>
                <div className="desktop-asset-preview"><DesktopAssetImage asset={asset} alt={`${work.code} ${asset.type}`} fallback={<span className="desktop-poster-placeholder"><b>{asset.type}</b></span>} /></div>
                <div className="desktop-asset-card-body">
                  <span>{assetTypeLabel(asset.type)} · <code>{asset.type}</code> · {asset.mimeType ?? "local asset"}</span>
                  <code>{asset.storagePath}</code>
                  <button className="danger-button" onClick={() => void removePrivateAsset(asset.id, asset.storagePath)}>{t("解除 / 删除")}</button>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="muted">{t("尚未关联本地图片资产。可在“本地资料”执行一键同步，将 Unified Root 中的 poster / fanart / thumb 导入。")}</p>}
      </section>
      <section className="settings-card">
        <span className="eyebrow">CLASSIFICATION</span>
        <h2>{t("分类引用")}</h2>
        <TokenList values={[...work.workTypeIds, ...work.genreIds, ...work.tagIds]} />
      </section>
    </div>
  );
}

function PeoplePage({
  repository,
  openPerson,
  onLibraryChanged,
  setMessage,
}: {
  repository: TauriLibraryRepository;
  openPerson: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
}) {
  const { t } = useDesktopI18n();
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="PEOPLE · PROFILE · ADVANCED FILTER"
        title={t("人物库")}
        description={t("对齐 Web 的人物高级筛选：姓名 / 别名、活动状态、出道年份、引退年份、出生年份、身高区间和排序；人物库仍按有 performer 作品关系的人物收口。")}
      />
      <CreatePersonPanel repository={repository} onSaved={(person) => { onLibraryChanged(); openPerson(person.id); }} setMessage={setMessage} />
      <DesktopPersonExplorer repository={repository} onOpen={openPerson} />
    </div>
  );
}

function PersonDetailPage({
  repository,
  id,
  onBack,
  openWork,
  onLibraryChanged,
  setMessage,
}: {
  repository: TauriLibraryRepository;
  id: string;
  onBack: () => void;
  openWork: (id: string) => void;
  onLibraryChanged: () => void;
  setMessage: (message: string) => void;
}) {
  const { t, metadataLanguage } = useDesktopI18n();
  const data = useAsyncData(async () => {
    const person = await repository.findPersonById(id);
    if (!person) return null;
    const [workCount, assets] = await Promise.all([
      repository.listWorks({ personIds: [id], page: 1, pageSize: 1 }),
      repository.listAssets(),
    ]);
    const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
    const portrait = (person.portraitAssetId ? assetsById.get(person.portraitAssetId) : undefined)
      ?? assets.find((asset) => asset.subjectType === "person" && asset.subjectId === person.id && asset.type === "portrait");
    return { person, workCount: workCount.total, portrait };
  }, [repository, id]);

  if (data.loading) return <LoadingState />;
  if (data.error || !data.value) return data.value === null ? <ErrorState error={t("人物不存在。")} /> : <ErrorState error={data.error} />;
  const { person, workCount, portrait } = data.value;
  const displayName = getPreferredPersonName(person, metadataLanguage);

  return (
    <div className="page-stack">
      <button className="back-button" onClick={onBack}>← {t("返回人物库")}</button>
      <section className="detail-hero person-detail-hero desktop-person-detail-hero">
        <div className="desktop-person-detail-portrait">
          <DesktopAssetImage asset={portrait} alt={`${displayName} portrait`} fallback={<span className="avatar-placeholder">{displayName.slice(0, 1)}</span>} />
        </div>
        <div className="desktop-person-detail-copy">
          <span className="status-chip">{person.activityStatus}</span>
          <h1>{displayName}</h1>
          <p>{localizeText(person.biographies, metadataLanguage, t("暂无人物简介"))}</p>
        </div>
      </section>
      <PersonEditor
        repository={repository}
        person={person}
        onSaved={onLibraryChanged}
        onDeleted={() => { onLibraryChanged(); onBack(); }}
        setMessage={setMessage}
      />
      <section className="detail-grid">
        <InfoCard label={t("出生日期")} value={person.birthDate?.value} />
        <InfoCard label={t("出生地")} value={localizeText(person.birthPlace, metadataLanguage)} />
        <InfoCard label={t("身高")} value={person.heightCm ? `${person.heightCm} cm` : undefined} />
        <InfoCard label={t("作品数")} value={String(workCount)} />
      </section>
      <section className="settings-card">
        <span className="eyebrow">NAMES</span>
        <h2>{t("名称 / 别名")}</h2>
        <div className="name-list">
          {person.names.map((name, index) => (
            <div key={`${name.language}-${name.type}-${index}`}>
              <span>{name.language} · {name.type}</span>
              <strong>{name.value}</strong>
            </div>
          ))}
        </div>
      </section>
      <SectionTitle eyebrow="RELATED WORKS · FACETED SEARCH" title={t("相关作品")} />
      <DesktopWorkExplorer
        repository={repository}
        onOpen={openWork}
        fixedPersonId={id}
        storageKey="localogue.desktop.person-related-work-view"
      />
    </div>
  );
}

function MediaPage({
  repository,
  settings,
  setMessage,
  progress,
  onLibraryChanged,
}: {
  repository: TauriLibraryRepository;
  settings: DesktopBootstrapSettings;
  setMessage: (message: string) => void;
  progress: DesktopTaskProgress | null;
  onLibraryChanged: () => void;
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

  async function startScan(): Promise<void> {
    if (!settings.libraryPath) {
      setMessage(t("请先在设置页选择 Private Library。Shared Pack 不能保存 MediaFile。"));
      return;
    }
    if (!mediaRoots.length) {
      setMessage(t("请先添加 Unified Library Root，或在高级设置里添加媒体扫描目录。"));
      return;
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
      setScan(
        coordinator.start({
          roots: mediaRoots,
          ffprobeExecutable: settings.ffprobePath?.trim() || "ffprobe",
          probeMedia: true,
          computeSha256: false,
          pruneMissing: true,
          // Unified Root 按文件扩展名分流：任何子目录中的视频都会被发现；图片由 Local Asset Ingest 单独处理，避免图片文件占用媒体发现上限。
          observeImageSidecars: false,
        }),
      );
      setMessage(t("Desktop 增量媒体扫描已启动；Unified Roots 与高级媒体路径已合并去重，Shared Pack Work 也参与匹配。"));
      if (scanTimer.current !== null) window.clearInterval(scanTimer.current);
      scanTimer.current = window.setInterval(() => {
        const snapshot = coordinator.getSnapshot();
        setScan(snapshot);
        if (snapshot && !["running", "cancelling"].includes(snapshot.status)) {
          if (scanTimer.current !== null) window.clearInterval(scanTimer.current);
          scanTimer.current = null;
          onLibraryChanged();
          setMessage(
            snapshot.status === "completed"
              ? t("Desktop 增量媒体扫描完成。")
              : snapshot.progress.message ?? t("媒体扫描已结束。"),
          );
        }
      }, 250);
    } catch (error) {
      setMessage(t("无法启动扫描：{error}", { error: toMessage(error) }));
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

    await startScan();
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
        {scan?.result ? <div className="mini-stat-grid">
          <MiniStat label={t("已发现")} value={scan.result.discovered} />
          <MiniStat label={t("新增")} value={scan.result.added} />
          <MiniStat label={t("已更新")} value={scan.result.updated} />
          <MiniStat label={t("未变化")} value={scan.result.unchanged} />
          <MiniStat label={t("已移除")} value={scan.result.removed} />
        </div> : null}
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
              <td>{group.title ?? group.representative.error ?? "—"}</td>
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
  packInfos,
  busy,
  onSave,
  setMessage,
  onOpenSettings,
}: {
  settings: DesktopBootstrapSettings;
  setSettings: Dispatch<SetStateAction<DesktopBootstrapSettings>>;
  privateLibraryPath?: string;
  packInfos: DesktopSharedPackInfo[];
  busy: boolean;
  onSave: () => Promise<void>;
  setMessage: (message: string) => void;
  onOpenSettings: () => void;
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
  setMessage,
}: {
  runtime: DesktopRuntimeInfo | null;
  settings: DesktopBootstrapSettings;
  setSettings: Dispatch<SetStateAction<DesktopBootstrapSettings>>;
  busy: boolean;
  packInfos: DesktopSharedPackInfo[];
  onSave: () => void;
  setMessage: (message: string) => void;
}) {
  const { t } = useDesktopI18n();

  async function chooseLibrary(): Promise<void> {
    const path = await fileDialog.pickDirectory();
    if (path) setSettings((current) => ({ ...current, libraryPath: path }));
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
      <PageTitle eyebrow="INSTANCE · STORAGE · SHARING" title={t("桌面设置")} description={t("Desktop 与 Web 使用相同字段语义，但运行入口各自保存本机路径，避免开发/发布环境互相污染。")} />
      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">PRIVATE LIBRARY</span><h2>{t("私人资料库")}</h2></div><button onClick={() => void chooseLibrary()}>{t("选择目录")}</button></div>
        <code className="path-block">{settings.libraryPath || t("尚未选择")}</code>
        {settings.libraryPath ? <button className="danger-button" onClick={() => setSettings((current) => ({ ...current, libraryPath: undefined }))}>{t("清除 Private Library")}</button> : null}
      </section>

      <section className="settings-card featured-card">
        <div className="section-heading"><div><span className="eyebrow">UNIFIED LIBRARY ROOTS</span><h2>{t("统一资料源根目录")}</h2></div><button className="primary-button" onClick={() => void addLibraryRoot()}>{t("+ 添加资料源")}</button></div>
        <p className="muted">{t("推荐配置。一个根目录下可以同时有“VR / 单体 / 封面+元数据 / 字幕”等任意子目录；Desktop 会按文件类型递归发现视频、NFO、poster / fanart / thumb，并按番号跨目录关联。")}</p>
        <PathList values={settings.libraryRoots} onRemove={(path) => setSettings((current) => ({ ...current, libraryRoots: current.libraryRoots.filter((item) => item !== path) }))} />
      </section>

      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">SHARED PACKS</span><h2>{t("只读共享资料")}</h2></div><button onClick={() => void addSharedPack()}>{t("+ 挂载资料包")}</button></div>
        <PathList values={settings.sharedPackPaths} onRemove={(path) => setSettings((current) => ({ ...current, sharedPackPaths: current.sharedPackPaths.filter((item) => item !== path) }))} />
        {packInfos.length ? <p className="muted">{t("当前已保存配置中：{valid} 个有效，{invalid} 个需要检查。", { valid: packInfos.filter((item) => item.valid).length, invalid: packInfos.filter((item) => !item.valid).length })}</p> : null}
      </section>

      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">ADVANCED MEDIA ROOTS</span><h2>{t("高级：额外媒体目录")}</h2></div><button onClick={() => void addMediaRoot()}>{t("+ 添加目录")}</button></div>
        <p className="muted">{t("可选。只在媒体不位于 Unified Library Root 中时添加；扫描时会与 Unified Roots 合并去重。")}</p>
        <PathList values={settings.mediaScanPaths} onRemove={(path) => setSettings((current) => ({ ...current, mediaScanPaths: current.mediaScanPaths.filter((item) => item !== path) }))} />
      </section>

      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">ADVANCED METADATA ROOTS</span><h2>{t("高级：额外 NFO / 图片目录")}</h2></div><button onClick={() => void addNfoRoot()}>{t("+ 添加目录")}</button></div>
        <p className="muted">{t("可选。适合 NFO / 海报完全放在另一块硬盘的情况；这里的目录也会参与 poster / fanart / thumb 发现。")}</p>
        <PathList values={settings.nfoScanPaths} onRemove={(path) => setSettings((current) => ({ ...current, nfoScanPaths: current.nfoScanPaths.filter((item) => item !== path) }))} />
      </section>

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

function DetailPeople({
  title,
  relations,
  people,
  onOpen,
}: {
  title: string;
  relations: Work["personRelations"];
  people: Map<string, Person>;
  onOpen: (id: string) => void;
}) {
  const { metadataLanguage } = useDesktopI18n();
  if (!relations.length) return null;
  return (
    <section className="settings-card">
      <span className="eyebrow">RELATIONS</span><h2>{title}</h2>
      <div className="people-inline">
        {relations.map((relation) => {
          const person = people.get(relation.personId);
          return <button key={`${relation.personId}-${relation.role}`} onClick={() => onOpen(relation.personId)}>{person ? getPreferredPersonName(person, metadataLanguage) : relation.personId}</button>;
        })}
      </div>
    </section>
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
  const [state, setState] = useState<{ loading: boolean; value?: T; error?: unknown }>({ loading: true });
  // Callers explicitly provide the stable dependency contract. The async factory itself is
  // intentionally recreated by page components, so exhaustive-deps is disabled only here.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    let disposed = false;
    setState({ loading: true });
    void factory().then((value) => {
      if (!disposed) setState({ loading: false, value });
    }).catch((error: unknown) => {
      if (!disposed) setState({ loading: false, error });
    });
    return () => { disposed = true; };
  }, dependencies);
  /* eslint-enable react-hooks/exhaustive-deps */
  return state;
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
