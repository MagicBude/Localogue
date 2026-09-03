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
import type { MediaFile } from "@/domain/entities/media-file";
import type { MediaScanJobSnapshot } from "@/domain/entities/media-scan";
import type { Organization } from "@/domain/entities/organization";
import type { Person } from "@/domain/entities/person";
import type { Work } from "@/domain/entities/work";
import type { PersonSort } from "@/domain/queries/person-query";
import type { WorkSort } from "@/domain/queries/work-query";
import type { LibraryRepository } from "@/domain/repositories/library-repository";

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
  DesktopWorkViewSwitcher,
  type DesktopWorkViewMode,
} from "./desktop-work-results";
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

type DesktopPage = "home" | "works" | "people" | "media" | "packs" | "settings";
type DetailTarget = { kind: "work" | "person"; id: string } | null;

const NAV_ITEMS: Array<{ id: DesktopPage; label: string; eyebrow: string }> = [
  { id: "home", label: "首页", eyebrow: "HOME" },
  { id: "works", label: "作品", eyebrow: "WORKS" },
  { id: "people", label: "人物", eyebrow: "PEOPLE" },
  { id: "media", label: "媒体", eyebrow: "MEDIA" },
  { id: "packs", label: "资料包", eyebrow: "PACKS" },
  { id: "settings", label: "设置", eyebrow: "SETTINGS" },
];

export default function App() {
  const [runtime, setRuntime] = useState<DesktopRuntimeInfo | null>(null);
  const [settings, setSettings] = useState<DesktopBootstrapSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<DesktopBootstrapSettings>(DEFAULT_SETTINGS);
  const [packInfos, setPackInfos] = useState<DesktopSharedPackInfo[]>([]);
  const [page, setPage] = useState<DesktopPage>("home");
  const [detail, setDetail] = useState<DetailTarget>(null);
  const [message, setMessage] = useState("正在连接 Tauri Runtime…");
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
        if (!disposed) setMessage("Desktop 已连接；正在直接读取 Localogue Canonical Library。");
      })
      .catch((error: unknown) => {
        if (!disposed) setMessage(`无法连接 Desktop Runtime：${toMessage(error)}`);
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
  }, [refreshSources]);

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
      setMessage("Desktop 实例设置已保存；Unified Library Roots、兼容扫描路径与 Shared Packs 已重新加载。");
    } catch (error) {
      setMessage(`保存失败：${toMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  const hasLibrarySource = readRoots.length > 0;

  return (
    <div className="desktop-layout">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("home")}>
          <span className="brand-mark">L</span>
          <span>
            <strong>Localogue</strong>
            <small>Desktop · V1-18</small>
          </span>
        </button>

        <nav className="nav-list" aria-label="Desktop navigation">
          {NAV_ITEMS.map((item) => (
            <button
              className={page === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => navigate(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.eyebrow}</small>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="source-summary">
          <span className="eyebrow">LIBRARY SOURCES</span>
          <strong>{readRoots.length}</strong>
          <small>
            {savedSettings.libraryPath ? "Private + " : ""}
            {packInfos.filter((item) => item.valid).length} Shared
          </small>
        </div>
        <div className="runtime-pill">
          <span className={runtime ? "runtime-dot online" : "runtime-dot"} />
          <span>{runtime ? `${runtime.environment} · ${runtime.version}` : "connecting"}</span>
        </div>
      </aside>

      <main className="content-shell">
        <header className="topbar">
          <div>
            <span className="eyebrow">NFO LIBRARY INGEST · FEATURE PARITY II</span>
            <strong>{NAV_ITEMS.find((item) => item.id === page)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <button className="ghost-button" onClick={refreshLibrary}>刷新资料</button>
            <button className="ghost-button" onClick={() => navigate("settings")}>实例设置</button>
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
  return (
    <section className="empty-state large-empty">
      <span className="eyebrow">NO LIBRARY SOURCE</span>
      <h1>先连接你的资料库</h1>
      <p>
        Desktop 不再依赖浏览器页面。配置 Private Library 或挂载 Shared Pack 后，
        Works / People / Media 会直接在这个窗口读取同一套 Canonical JSON。
      </p>
      <button className="primary-button" onClick={onConfigure}>打开设置</button>
    </section>
  );
}

function HomePage({
  repository,
  openWork,
  openPerson,
}: {
  repository: LibraryRepository;
  openWork: (id: string) => void;
  openPerson: (id: string) => void;
}) {
  const data = useAsyncData(async () => {
    const [works, people, organizations, series, media] = await Promise.all([
      repository.listWorks({ page: 1, pageSize: 6, sort: "release_desc" }),
      repository.listPeople({ page: 1, pageSize: 9999, sort: "name_asc" }),
      repository.listOrganizations(),
      repository.listSeries(),
      repository.listMediaFiles(),
    ]);
    const performerIds = new Set(
      works.items.flatMap((work) =>
        work.personRelations
          .filter((relation) => relation.role === "performer")
          .map((relation) => relation.personId),
      ),
    );
    return {
      works,
      people,
      organizations,
      series,
      media,
      featuredPeople: people.items.filter((person) => performerIds.has(person.id)).slice(0, 6),
    };
  }, [repository]);

  if (data.loading) return <LoadingState />;
  if (data.error || !data.value) return <ErrorState error={data.error} />;

  const { works, people, organizations, series, media, featuredPeople } = data.value;
  const workCount = works.total;
  const peopleCount = people.total;

  return (
    <div className="page-stack">
      <section className="hero-panel desktop-hero">
        <span className="eyebrow">LOCAL-FIRST · CURATION · EXPLORATION</span>
        <h1>你的 Localogue，现在就在桌面端。</h1>
        <p>
          V1-18 已进入 Presentation Parity 与 Unified Library Sync 阶段。作品页已对齐海报墙 / 列表 / 表格三视图，本地 poster / cover 可直接显示；本地资料支持一键按 NFO → Asset → Media 顺序同步。首页、作品、人物、媒体、资料包与设置
          直接读取和 Web 相同的数据模型，并共享查询规则；视频、NFO 与本地海报可以跨子目录按 Work 汇聚。
        </p>
      </section>

      <section className="stat-grid">
        <Stat label="Works" value={workCount} note="Canonical" />
        <Stat label="People" value={peopleCount} note="Canonical" />
        <Stat label="Makers" value={organizations.filter((item) => item.kind === "maker").length} note="Organizations" />
        <Stat label="Series" value={series.length} note="Canonical" />
        <Stat label="Media" value={media.length} note="Private" />
      </section>

      <SectionTitle eyebrow="RECENT WORKS" title="最近作品" />
      <div className="work-grid">
        {works.items.map((work) => (
          <WorkTile key={work.id} work={work} onOpen={() => openWork(work.id)} />
        ))}
      </div>

      {featuredPeople.length ? (
        <>
          <SectionTitle eyebrow="PEOPLE" title="相关人物" />
          <div className="people-grid">
            {featuredPeople.map((person) => (
              <PersonTile key={person.id} person={person} onOpen={() => openPerson(person.id)} />
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
  const [text, setText] = useState("");
  const [sort, setSort] = useState<WorkSort>("release_desc");
  const [mediaFilter, setMediaFilter] = useState<"all" | "yes" | "no">("all");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<DesktopWorkViewMode>(() => {
    const saved = window.localStorage.getItem("localogue.desktop.work-view");
    return saved === "list" || saved === "table" ? saved : "grid";
  });
  const pageSize = 24;

  useEffect(() => setPage(1), [text, sort, mediaFilter]);

  const data = useAsyncData(async () => {
    const result = await repository.listWorks({
      text: text || undefined,
      page,
      pageSize,
      sort,
      ...(mediaFilter === "all" ? {} : { hasMedia: mediaFilter === "yes" }),
    });
    const [people, organizations, assets] = await Promise.all([
      repository.listPeople({ page: 1, pageSize: 100000 }),
      repository.listOrganizations(),
      repository.listAssets(),
    ]);
    return {
      result,
      cards: buildDesktopWorkCards(result.items, people.items, organizations, assets),
    };
  }, [repository, text, sort, mediaFilter, page]);

  function changeView(next: DesktopWorkViewMode): void {
    setView(next);
    window.localStorage.setItem("localogue.desktop.work-view", next);
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="CANONICAL WORKS · PRESENTATION PARITY"
        title="作品库"
        description="Desktop 与 Web 共用 WorkQuery，并对齐海报墙 / 列表 / 表格三种作品视图；Private poster / cover 会通过受限 Native Asset Reader 直接显示。"
      />
      <CreateWorkPanel repository={repository} onSaved={(work) => { onLibraryChanged(); openWork(work.id); }} setMessage={setMessage} />
      <section className="filter-bar">
        <label className="search-box"><span>搜索番号或标题</span><input value={text} onChange={(event: ChangeEvent<HTMLInputElement>) => setText(event.target.value)} placeholder="例如 MIDV-077 / タイトル" /></label>
        <label><span>排序</span><select value={sort} onChange={(event) => setSort(event.target.value as WorkSort)}><option value="release_desc">发行日期 ↓</option><option value="release_asc">发行日期 ↑</option><option value="code_asc">番号 A→Z</option><option value="code_desc">番号 Z→A</option><option value="title_asc">标题 A→Z</option><option value="updated_desc">最近更新</option></select></label>
        <label><span>本地媒体</span><select value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value as "all" | "yes" | "no")}><option value="all">全部</option><option value="yes">已有媒体</option><option value="no">无媒体</option></select></label>
      </section>
      {data.loading ? <LoadingState /> : data.error || !data.value ? <ErrorState error={data.error} /> : (
        <>
          <div className="desktop-results-toolbar">
            <div className="result-meta"><strong>{data.value.result.total}</strong> 项作品 · 第 {data.value.result.page} 页</div>
            <DesktopWorkViewSwitcher current={view} onChange={changeView} />
          </div>
          <DesktopWorkResults cards={data.value.cards} view={view} onOpen={openWork} />
          {!data.value.cards.length ? <EmptyResults /> : null}
          {data.value.result.total > pageSize ? (
            <div className="desktop-pagination" aria-label="作品分页">
              <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← 上一页</button>
              <span>{page} / {Math.max(1, Math.ceil(data.value.result.total / pageSize))}</span>
              <button disabled={page * pageSize >= data.value.result.total} onClick={() => setPage((value) => value + 1)}>下一页 →</button>
            </div>
          ) : null}
        </>
      )}
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
  if (data.error || !data.value) return data.value === null ? <ErrorState error="作品不存在。" /> : <ErrorState error={data.error} />;
  const { work, people, organizations, series, media, assets } = data.value;
  const poster = chooseWorkPoster(assets);

  const performers = work.personRelations.filter((item) => item.role === "performer");
  const directors = work.personRelations.filter((item) => item.role === "director");

  async function removePrivateAsset(assetId: string, storagePath: string): Promise<void> {
    try {
      const isPrivateAsset = await repository.isPrivateEntity("assets", assetId);
      if (!isPrivateAsset) {
        setMessage("该 Asset 来自 Shared Pack，不能直接删除；Shared Pack 始终只读。");
        return;
      }
      if (!window.confirm(`从 ${work.code} 解除并删除这个 Private Asset 元数据？\n\n${storagePath}\n\n原始图片与 content-addressed 文件不会在 V1-18 自动物理删除。`)) return;
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
      setMessage(`已从 ${work.code} 解除并删除 Private Asset 元数据；图片文件保留。`);
      onLibraryChanged();
    } catch (error) {
      setMessage(`删除 Asset 失败：${toMessage(error)}`);
    }
  }

  return (
    <div className="page-stack">
      <button className="back-button" onClick={onBack}>← 返回作品库</button>
      <section className="detail-hero desktop-work-detail-hero">
        <div className="desktop-work-detail-poster">
          <DesktopAssetImage asset={poster} alt={`${work.code} poster`} fallback={<span className="desktop-poster-placeholder"><b>{work.code}</b></span>} />
        </div>
        <div className="desktop-work-detail-copy">
          <div className="code-badge">{work.code}</div>
          <h1>{localizeText(work.titles, "ja")}</h1>
          <p>{localizeText(work.descriptions, "zh-CN", "暂无简介")}</p>
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
        <InfoCard label="发行日期" value={work.releaseDate?.value} />
        <InfoCard label="时长" value={work.durationMinutes ? `${work.durationMinutes} 分钟` : undefined} />
        <InfoCard label="厂商" value={organizationName(organizations.get(work.makerId ?? ""))} />
        <InfoCard label="厂牌" value={organizationName(organizations.get(work.labelId ?? ""))} />
        <InfoCard label="Series" value={work.seriesIds.map((seriesId) => localizeText(series.get(seriesId)?.names, "ja")).filter((value) => value !== "—").join(" · ") || undefined} />
        <InfoCard label="本地媒体" value={`${media.length} 个文件`} />
        <InfoCard label="本地图片" value={`${assets.length} 个资产`} />
      </section>
      <DetailPeople title="演员" relations={performers} people={people} onOpen={openPerson} />
      <DetailPeople title="导演" relations={directors} people={people} onOpen={openPerson} />
      <section className="settings-card">
        <span className="eyebrow">LOCAL ASSETS</span>
        <h2>本地海报 / 封面 / Fanart</h2>
        {assets.length ? (
          <div className="desktop-asset-gallery">
            {assets.map((asset) => (
              <article className="desktop-asset-card" key={asset.id}>
                <div className="desktop-asset-preview"><DesktopAssetImage asset={asset} alt={`${work.code} ${asset.type}`} fallback={<span className="desktop-poster-placeholder"><b>{asset.type}</b></span>} /></div>
                <div className="desktop-asset-card-body">
                  <span>{asset.type} · {asset.mimeType ?? "local asset"}</span>
                  <code>{asset.storagePath}</code>
                  <button className="danger-button" onClick={() => void removePrivateAsset(asset.id, asset.storagePath)}>解除 / 删除</button>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="muted">尚未关联本地图片资产。可在“本地资料”执行一键同步，将 Unified Root 中的 poster / cover / fanart / thumb 导入。</p>}
      </section>
      <section className="settings-card">
        <span className="eyebrow">CLASSIFICATION</span>
        <h2>分类引用</h2>
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
  const [text, setText] = useState("");
  const [sort, setSort] = useState<PersonSort>("name_asc");
  const [status, setStatus] = useState("all");
  const data = useAsyncData(
    () => repository.listPeople({
      text: text || undefined,
      page: 1,
      pageSize: 1000,
      sort,
      ...(status === "all" ? {} : { statuses: [status] }),
    }),
    [repository, text, sort, status],
  );

  return (
    <div className="page-stack">
      <PageTitle eyebrow="CANONICAL PEOPLE" title="人物库" description="正式名、译名、罗马字、别名和旧艺名进入共享查询范围；Private Person 可在 Desktop 新建、编辑与安全删除。" />
      <CreatePersonPanel repository={repository} onSaved={(person) => { onLibraryChanged(); openPerson(person.id); }} setMessage={setMessage} />
      <section className="filter-bar">
        <label className="search-box"><span>搜索人物</span><input value={text} onChange={(event: ChangeEvent<HTMLInputElement>) => setText(event.target.value)} placeholder="姓名 / 别名 / 旧艺名" /></label>
        <label><span>排序</span><select value={sort} onChange={(event) => setSort(event.target.value as PersonSort)}><option value="name_asc">名称 A→Z</option><option value="name_desc">名称 Z→A</option><option value="birth_desc">出生日期 ↓</option><option value="debut_desc">出道日期 ↓</option><option value="height_desc">身高 ↓</option></select></label>
        <label><span>状态</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">全部</option><option value="active">active</option><option value="retired">retired</option><option value="hiatus">hiatus</option><option value="inactive">inactive</option><option value="unknown">unknown</option></select></label>
      </section>
      {data.loading ? <LoadingState /> : data.error || !data.value ? <ErrorState error={data.error} /> : (
        <>
          <div className="result-meta"><strong>{data.value.total}</strong> 项人物</div>
          <div className="people-grid">
            {data.value.items.map((person) => <PersonTile key={person.id} person={person} onOpen={() => openPerson(person.id)} />)}
          </div>
          {!data.value.items.length ? <EmptyResults /> : null}
        </>
      )}
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
  const data = useAsyncData(async () => {
    const person = await repository.findPersonById(id);
    if (!person) return null;
    const works = await repository.listWorks({ personIds: [id], page: 1, pageSize: 9999, sort: "release_desc" });
    return { person, works };
  }, [repository, id]);

  if (data.loading) return <LoadingState />;
  if (data.error || !data.value) return data.value === null ? <ErrorState error="人物不存在。" /> : <ErrorState error={data.error} />;
  const { person, works } = data.value;

  return (
    <div className="page-stack">
      <button className="back-button" onClick={onBack}>← 返回人物库</button>
      <section className="detail-hero person-detail-hero">
        <span className="status-chip">{person.activityStatus}</span>
        <h1>{getPreferredPersonName(person, "ja")}</h1>
        <p>{localizeText(person.biographies, "zh-CN", "暂无人物简介")}</p>
      </section>
      <PersonEditor
        repository={repository}
        person={person}
        onSaved={onLibraryChanged}
        onDeleted={() => { onLibraryChanged(); onBack(); }}
        setMessage={setMessage}
      />
      <section className="detail-grid">
        <InfoCard label="出生日期" value={person.birthDate?.value} />
        <InfoCard label="出生地" value={localizeText(person.birthPlace, "zh-CN")} />
        <InfoCard label="身高" value={person.heightCm ? `${person.heightCm} cm` : undefined} />
        <InfoCard label="作品数" value={String(works.total)} />
      </section>
      <section className="settings-card">
        <span className="eyebrow">NAMES</span>
        <h2>名称 / 别名</h2>
        <div className="name-list">
          {person.names.map((name, index) => (
            <div key={`${name.language}-${name.type}-${index}`}>
              <span>{name.language} · {name.type}</span>
              <strong>{name.value}</strong>
            </div>
          ))}
        </div>
      </section>
      <SectionTitle eyebrow="RELATED WORKS" title="相关作品" />
      <div className="work-grid">
        {works.items.map((work) => <WorkTile key={work.id} work={work} onOpen={() => openWork(work.id)} />)}
      </div>
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
      setMessage("请先在设置页选择 Private Library。Shared Pack 不能保存 MediaFile。 ");
      return;
    }
    if (!mediaRoots.length) {
      setMessage("请先添加 Unified Library Root，或在高级设置里添加媒体扫描目录。");
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
      setMessage("Desktop 增量媒体扫描已启动；Unified Roots 与高级媒体路径已合并去重，Shared Pack Work 也参与匹配。 ");
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
              ? "Desktop 增量媒体扫描完成。"
              : snapshot.progress.message ?? "媒体扫描已结束。",
          );
        }
      }, 250);
    } catch (error) {
      setMessage(`无法启动扫描：${toMessage(error)}`);
    }
  }

  async function scanMetadataSource(): Promise<void> {
    if (!settings.libraryPath) {
      setMessage("请先在设置页选择 Private Library；NFO 与本地 Asset 导入都会写入私人资料库。");
      return;
    }
    if (!nfoRoots.length && !assetRoots.length) {
      setMessage("请先添加 Unified Library Root，或配置高级 NFO / Media 扫描路径。");
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
      setMessage(`资料源扫描完成：发现 ${nfo.discovered} 个 NFO（${nfo.importable} 个 Work 候选）和 ${assets.discovered} 张图片（${assets.linkable} 张可关联）。`);
    } catch (error) {
      setMessage(`资料源扫描失败：${toMessage(error)}`);
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
      setMessage(`资料导入完成：${nfo ? `新建 Work ${nfo.createdWorks}、更新 ${nfo.updatedWorks}` : "无 NFO 写入"}；${assets ? `关联图片 ${assets.imported} 张、创建 Asset ${assets.createdAssets}` : "无图片写入"}。之后可运行媒体扫描按番号关联视频。`);
    } catch (error) {
      setMessage(`资料导入失败：${toMessage(error)}`);
    } finally {
      setMetadataBusy(false);
    }
  }

  async function syncUnifiedLibrary(): Promise<void> {
    if (!settings.libraryPath) {
      setMessage("请先在设置页选择 Private Library；统一同步需要写入 Work / Asset / MediaFile。");
      return;
    }
    if (!unique([...nfoRoots, ...assetRoots, ...mediaRoots]).length) {
      setMessage("请先添加 Unified Library Root，或配置高级扫描路径。");
      return;
    }
    if (metadataBusy || scan?.status === "running" || scan?.status === "cancelling") return;

    setMetadataBusy(true);
    setNfoResult(null);
    setAssetResult(null);
    try {
      setMessage("统一资料库同步：正在发现 NFO 与本地图片…");
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
      setMessage(`元数据与图片已同步：${nfo ? `NFO ${nfo.imported}，新建 Work ${nfo.createdWorks}` : "无 NFO 写入"}；${assets ? `图片 ${assets.imported}，Asset ${assets.createdAssets}` : `发现图片 ${assetPreviewNext.discovered}，可关联 ${assetPreviewNext.linkable}`}。正在继续启动媒体增量扫描…`);
    } catch (error) {
      setMessage(`统一资料库同步失败：${toMessage(error)}`);
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
      setMessage("ffprobe Native Command 执行成功。");
    } catch (error) {
      setMessage(`ffprobe 失败：${toMessage(error)}`);
    } finally {
      setProbing(false);
    }
  }

  return (
    <div className="page-stack">
      <PageTitle eyebrow="LOCAL · MEDIA · METADATA · ASSET" title="本地资料" description="一个 Unified Library Root 可以同时发现视频、NFO、poster / fanart / thumb；它们最终按 Work 番号汇聚，而不依赖同目录。" />
      <section className="settings-card unified-sync-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ONE ROOT · ONE ACTION</span>
            <h2>一键同步 Unified Library</h2>
            <p className="muted">按固定顺序执行 NFO → poster / cover / fanart / thumb → Media。这样不会再出现“视频已经扫描，但 Work / Asset 还没导入”的半同步状态。</p>
          </div>
          <button className="primary-button sync-library-button" disabled={metadataBusy || scan?.status === "running" || scan?.status === "cancelling"} onClick={() => void syncUnifiedLibrary()}>
            {metadataBusy || scan?.status === "running" ? "同步中…" : "同步资料库"}
          </button>
        </div>
        <code className="path-block">{unique([...settings.libraryRoots]).length ? unique([...settings.libraryRoots]).join("\n") : "尚未配置 Unified Library Root；仍可使用下方高级媒体 / NFO 路径。"}</code>
      </section>
      <section className="settings-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">INCREMENTAL MEDIA SCAN</span>
            <h2>媒体扫描</h2>
            <p className="muted">递归扫描 Unified Roots + 高级媒体路径。未变化文件继续走 V1-12 Fast Path。</p>
          </div>
          <div className="button-row">
            <button className="primary-button" disabled={scan?.status === "running" || scan?.status === "cancelling"} onClick={() => void startScan()}>仅扫描视频</button>
            <button disabled={scan?.status !== "running"} onClick={() => setScan(scanCoordinator.current?.cancel() ?? null)}>取消</button>
          </div>
        </div>
        <code className="path-block">{mediaRoots.length ? mediaRoots.join("\n") : "尚未配置可扫描资料根目录"}</code>
        {scan ? <div className={`progress ${scan.status}`}><strong>{scan.status} · {scan.progress.phase}</strong><span>{scan.progress.message}</span><span>{scan.progress.current} / {scan.progress.total}</span></div> : null}
        {scan?.result ? <div className="mini-stat-grid">
          <MiniStat label="Discovered" value={scan.result.discovered} />
          <MiniStat label="Added" value={scan.result.added} />
          <MiniStat label="Updated" value={scan.result.updated} />
          <MiniStat label="Unchanged" value={scan.result.unchanged} />
          <MiniStat label="Removed" value={scan.result.removed} />
        </div> : null}
      </section>

      <section className="settings-card table-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">UNIFIED METADATA SOURCE</span>
            <h2>NFO + 本地海报 / 封面</h2>
            <p className="muted">推荐只配置一个大目录。Desktop 会递归发现子目录中的 NFO、poster、fanart、thumb，再按番号或同 stem 汇聚到同一个 Work；原始图片不会移动。</p>
          </div>
          <div className="button-row">
            <button disabled={metadataBusy} onClick={() => void scanMetadataSource()}>{metadataBusy ? "处理中…" : "预览 NFO + 图片"}</button>
            <button className="primary-button" disabled={metadataBusy || !(nfoPreview?.importable || assetPreview?.linkable)} onClick={() => void importMetadataSource()}>导入当前预览</button>
          </div>
        </div>
        <code className="path-block">{unique([...nfoRoots, ...assetRoots]).length ? unique([...nfoRoots, ...assetRoots]).join("\n") : "尚未配置 Unified Library Root / 兼容扫描路径"}</code>

        {nfoPreview ? <>
          <SectionTitle eyebrow="NFO GROUPS" title="NFO 作品组" />
          <div className="mini-stat-grid">
            <MiniStat label="NFO Files" value={nfoPreview.discovered} />
            <MiniStat label="Work Candidates" value={nfoPreview.importable} />
            <MiniStat label="New Works" value={nfoPreview.newWorks} />
            <MiniStat label="Existing" value={nfoPreview.existingWorks} />
            <MiniStat label="Skipped Files" value={nfoPreview.skipped + nfoPreview.errors} />
          </div>
          <div className="table-wrap nfo-preview-table"><table className="data-table"><thead><tr><th>作品组 / NFO 来源</th><th>番号</th><th>标题</th><th>状态</th></tr></thead><tbody>
            {nfoPreview.groups.slice(0, 100).map((group) => <tr key={group.key}>
              <td>
                <strong>{group.sourceCount > 1 ? `${group.sourceCount} 个 NFO 来源` : group.representative.fileName}</strong>
                {group.sourceCount > 1 ? <details><summary>查看文件</summary><small className="path-text">{group.sources.map((item) => item.fileName).join("\n")}</small></details> : <small className="path-text">{group.representative.path}</small>}
              </td>
              <td>{group.code ?? "—"}</td>
              <td>{group.title ?? group.representative.error ?? "—"}</td>
              <td><span className={nfoStatusClass(group.status)}>{nfoStatusLabel(group.status)}{group.sourceCount > 1 ? ` · ${group.sourceCount} sources` : ""}</span></td>
            </tr>)}
          </tbody></table></div>
          {nfoPreview.groups.length > 100 ? <p className="muted">NFO 预览只显示前 100 个作品组；导入会处理全部 {nfoPreview.importable} 个可识别 Work 候选。</p> : null}
        </> : <p className="muted">多段 NFO（例如 MDVR-195.part1～part6）会聚合成一个 Work 组，不再把其余文件显示成一长串“重复番号”。</p>}

        {assetPreview ? <>
          <SectionTitle eyebrow="LOCAL ASSET CANDIDATES" title="本地图片资产" />
          <div className="mini-stat-grid">
            <MiniStat label="Images" value={assetPreview.discovered} />
            <MiniStat label="Linkable" value={assetPreview.linkable} />
            <MiniStat label="Pending Work" value={assetPreview.pendingWork} />
            <MiniStat label="Skipped" value={assetPreview.skipped} />
          </div>
          <div className="table-wrap"><table className="data-table"><thead><tr><th>图片</th><th>番号</th><th>类型</th><th>匹配</th><th>状态</th></tr></thead><tbody>
            {assetPreview.items.slice(0, 100).map((item) => <tr key={item.path}>
              <td><strong>{item.fileName}</strong><small className="path-text">{item.path}</small></td>
              <td>{item.code ?? "—"}</td>
              <td>{item.type ?? "—"}</td>
              <td>{item.matchedBy === "nfo-stem" ? "同 NFO stem" : item.matchedBy === "filename-code" ? "文件名番号" : "—"}</td>
              <td><span className={assetStatusClass(item.status)}>{assetStatusLabel(item.status)}</span></td>
            </tr>)}
          </tbody></table></div>
          {assetPreview.items.length > 100 ? <p className="muted">图片预览只显示前 100 条；实际导入会处理全部 {assetPreview.linkable} 张可关联图片。</p> : null}
        </> : null}

        {nfoResult ? <p className="success-message">NFO：导入 {nfoResult.imported} · 新建 Work {nfoResult.createdWorks} · 更新 {nfoResult.updatedWorks} · 新建 Person {nfoResult.createdPeople} · 新建 Organization {nfoResult.createdOrganizations}</p> : null}
        {assetResult ? <p className="success-message">图片：关联 {assetResult.imported} · 新建 Asset {assetResult.createdAssets} · 复用 {assetResult.reusedAssets} · 更新 Work {assetResult.updatedWorks}</p> : null}
        {nfoResult?.warnings.length ? <details><summary>{nfoResult.warnings.length} 条 NFO 导入警告</summary><ul>{nfoResult.warnings.slice(0, 50).map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
        {assetResult?.warnings.length ? <details><summary>{assetResult.warnings.length} 条 Asset 导入警告</summary><ul>{assetResult.warnings.slice(0, 50).map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
      </section>

      <section className="settings-card">
        <div className="section-heading">
          <div><span className="eyebrow">NATIVE PROBE</span><h2>单文件检查</h2></div>
          <button onClick={() => void chooseAndProbe()} disabled={probing}>选择 MP4 / MKV…</button>
        </div>
        {selectedPath ? <code className="path-block">{selectedPath}</code> : <p className="muted">可选择任意受支持视频验证 ffprobe、打开与定位能力。</p>}
        <div className="button-row">
          <button disabled={!selectedPath} onClick={() => void fileOpener.openPath(selectedPath)}>默认播放器打开</button>
          <button disabled={!selectedPath} onClick={() => void fileOpener.revealInFolder(selectedPath)}>资源管理器中定位</button>
        </div>
        {progress ? <div className={`progress ${progress.stage}`}><strong>{progress.stage}</strong><span>{progress.message}</span></div> : null}
        {probe ? <div className="detail-grid compact-grid">
          <InfoCard label="Duration" value={formatDuration(probe.durationSeconds)} />
          <InfoCard label="Resolution" value={probe.width && probe.height ? `${probe.width} × ${probe.height}` : undefined} />
          <InfoCard label="Video" value={probe.videoCodec} />
          <InfoCard label="Audio" value={probe.audioCodec} />
          <InfoCard label="Container" value={probe.container} />
        </div> : null}
      </section>

      {data.loading ? <LoadingState /> : data.error || !data.value ? <ErrorState error={data.error} /> : (
        <section className="settings-card table-card">
          <div className="section-heading"><div><span className="eyebrow">PRIVATE LOCAL DATA</span><h2>{data.value.media.length} 个视频 · {data.value.assets.length} 个 Asset</h2></div></div>
          {data.value.media.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>文件</th><th>Work</th><th>大小</th><th>媒体参数</th><th>操作</th></tr></thead><tbody>
            {data.value.media.map((file) => {
              const work = file.workId ? data.value!.works.get(file.workId) : undefined;
              return <tr key={file.id}>
                <td><strong>{file.fileName}</strong><small className="path-text">{file.path}</small></td>
                <td>{work ? <><strong>{work.code}</strong><small>{localizeText(work.titles, "ja")}</small></> : <span className="status-chip warn">未绑定</span>}</td>
                <td>{formatBytes(file.fileSize ?? 0)}</td>
                <td>{mediaSummary(file)}</td>
                <td><div className="row-actions"><button onClick={() => void fileOpener.openPath(file.path)}>打开</button><button onClick={() => void fileOpener.revealInFolder(file.path)}>定位</button><button className={bindingMediaId === file.id ? "primary-button" : ""} onClick={() => setBindingMediaId((current) => current === file.id ? null : file.id)}>管理绑定</button></div></td>
              </tr>;
            })}
          </tbody></table></div> : <p className="muted">尚未扫描到本地媒体。</p>}
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
  async function addPack(): Promise<void> {
    const path = await fileDialog.pickDirectory();
    if (!path) return;
    try {
      const inspected = await desktopBridge.inspectSharedPack(path);
      if (!inspected.valid) throw new Error(inspected.error ?? "Shared Pack 校验失败。");
      setSettings((current) => ({ ...current, sharedPackPaths: unique([...current.sharedPackPaths, path]) }));
      setMessage(`已加入 Shared Pack 草稿：${inspected.name ?? path}。点击“保存资料包配置”后生效。`);
    } catch (error) {
      setMessage(`无法挂载 Shared Pack：${toMessage(error)}`);
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
      <PageTitle eyebrow="SHARED · PRIVATE · PRIORITY" title="资料包" description="Shared Pack 在 Desktop 中支持挂载、Native 校验、优先级调整和卸载；内容仍由 Rust Boundary 强制只读。" />
      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">SOURCE PRIORITY</span><h2>当前资料源优先级</h2><p className="muted">Private 永远最高；Shared Pack 顺序决定相同稳定 ID 的读取优先级。</p></div><div className="button-row"><button onClick={() => void addPack()}>+ 挂载 Shared Pack</button><button className="primary-button" disabled={busy || !hasDraftChanges} onClick={() => void onSave()}>{busy ? "保存中…" : "保存资料包配置"}</button></div></div>
        <ol className="source-priority-list">
          {privateLibraryPath ? <li><span className="source-index">1</span><div><strong>Private Library</strong><code>{privateLibraryPath}</code></div><span className="status-chip ok">WRITABLE</span></li> : null}
          {settings.sharedPackPaths.map((path, index) => {
            const pack = packInfos.find((item) => item.configuredPath === path);
            return <li key={path}>
              <span className="source-index">{index + (privateLibraryPath ? 2 : 1)}</span>
              <div><strong>{pack?.name ?? path}</strong><code>{pack?.libraryPath ?? path}</code><small>{pack ? (pack.valid ? `${pack.id} · ${pack.version}${pack.license ? ` · ${pack.license}` : ""}` : pack.error) : "尚未保存 / 重新校验"}</small></div>
              <div className="pack-actions"><button disabled={index === 0} onClick={() => movePack(index, -1)}>↑</button><button disabled={index === settings.sharedPackPaths.length - 1} onClick={() => movePack(index, 1)}>↓</button><button className="danger-button" onClick={() => removePack(path)}>卸载</button></div>
            </li>;
          })}
        </ol>
        {!privateLibraryPath && !settings.sharedPackPaths.length ? <p className="muted">当前没有配置资料源。</p> : null}
        {hasDraftChanges ? <p className="status-chip warn">存在未保存的 Shared Pack 变更</p> : <p className="status-chip ok">Shared Pack 配置已保存</p>}
      </section>
      <section className="settings-card soft-card">
        <span className="eyebrow">NATIVE READ-ONLY BOUNDARY</span>
        <h2>Shared Pack 不会被 Desktop CRUD 修改</h2>
        <p>编辑 Shared Work / Person 时，Desktop 会在 Private Library 写入同 ID Override；删除也只删除 Private Override。Shared Pack 本身不会通过 Canonical Writer 被修改。</p>
        <button onClick={onOpenSettings}>打开完整实例设置</button>
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
      setMessage("已交给系统浏览器打开 Localogue Web。");
    } catch (error) {
      setMessage(`无法打开 Web URL：${toMessage(error)}`);
    }
  }

  return (
    <div className="page-stack">
      <PageTitle eyebrow="INSTANCE · STORAGE · SHARING" title="桌面设置" description="Desktop 与 Web 使用相同字段语义，但运行入口各自保存本机路径，避免开发/发布环境互相污染。" />
      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">PRIVATE LIBRARY</span><h2>私人资料库</h2></div><button onClick={() => void chooseLibrary()}>选择目录</button></div>
        <code className="path-block">{settings.libraryPath || "尚未选择"}</code>
        {settings.libraryPath ? <button className="danger-button" onClick={() => setSettings((current) => ({ ...current, libraryPath: undefined }))}>清除 Private Library</button> : null}
      </section>

      <section className="settings-card featured-card">
        <div className="section-heading"><div><span className="eyebrow">UNIFIED LIBRARY ROOTS</span><h2>统一资料源根目录</h2></div><button className="primary-button" onClick={() => void addLibraryRoot()}>+ 添加资料源</button></div>
        <p className="muted">推荐配置。一个根目录下可以同时有“VR / 单体 / 封面+元数据 / 字幕”等任意子目录；Desktop 会按文件类型递归发现视频、NFO、poster / fanart / thumb，并按番号跨目录关联。</p>
        <PathList values={settings.libraryRoots} onRemove={(path) => setSettings((current) => ({ ...current, libraryRoots: current.libraryRoots.filter((item) => item !== path) }))} />
      </section>

      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">SHARED PACKS</span><h2>只读共享资料</h2></div><button onClick={() => void addSharedPack()}>+ 挂载资料包</button></div>
        <PathList values={settings.sharedPackPaths} onRemove={(path) => setSettings((current) => ({ ...current, sharedPackPaths: current.sharedPackPaths.filter((item) => item !== path) }))} />
        {packInfos.length ? <p className="muted">当前已保存配置中：{packInfos.filter((item) => item.valid).length} 个有效，{packInfos.filter((item) => !item.valid).length} 个需要检查。</p> : null}
      </section>

      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">ADVANCED MEDIA ROOTS</span><h2>高级：额外媒体目录</h2></div><button onClick={() => void addMediaRoot()}>+ 添加目录</button></div>
        <p className="muted">可选。只在媒体不位于 Unified Library Root 中时添加；扫描时会与 Unified Roots 合并去重。</p>
        <PathList values={settings.mediaScanPaths} onRemove={(path) => setSettings((current) => ({ ...current, mediaScanPaths: current.mediaScanPaths.filter((item) => item !== path) }))} />
      </section>

      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">ADVANCED METADATA ROOTS</span><h2>高级：额外 NFO / 图片目录</h2></div><button onClick={() => void addNfoRoot()}>+ 添加目录</button></div>
        <p className="muted">可选。适合 NFO / 海报完全放在另一块硬盘的情况；这里的目录也会参与 poster / fanart / thumb 发现。</p>
        <PathList values={settings.nfoScanPaths} onRemove={(path) => setSettings((current) => ({ ...current, nfoScanPaths: current.nfoScanPaths.filter((item) => item !== path) }))} />
      </section>

      <section className="settings-card form-card">
        <label>ffprobe<input value={settings.ffprobePath ?? ""} placeholder="ffprobe" onChange={(event: ChangeEvent<HTMLInputElement>) => setSettings((current) => ({ ...current, ffprobePath: event.target.value }))} /></label>
        <label>Localogue Web URL<input value={settings.webUrl} onChange={(event: ChangeEvent<HTMLInputElement>) => setSettings((current) => ({ ...current, webUrl: event.target.value }))} /></label>
        <div className="button-row"><button onClick={() => void openWeb()}>浏览器打开 Web</button><button className="primary-button" disabled={busy} onClick={onSave}>{busy ? "保存中…" : "保存桌面设置"}</button></div>
      </section>

      <section className="settings-card soft-card">
        <span className="eyebrow">RUNTIME</span>
        <h2>Tauri Runtime</h2>
        <div className="runtime-info-grid">
          <InfoCard label="Product" value={runtime?.productName} />
          <InfoCard label="Version" value={runtime?.version} />
          <InfoCard label="Identifier" value={runtime?.identifier} />
          <InfoCard label="Environment" value={runtime?.environment} />
        </div>
        <code className="path-block">{runtime?.settingsPath ?? "—"}</code>
      </section>
    </div>
  );
}

function WorkTile({ work, onOpen }: { work: Work; onOpen: () => void }) {
  return (
    <button className="work-tile" onClick={onOpen}>
      <span className="work-poster-placeholder"><span>{work.code.slice(0, 2)}</span></span>
      <span className="work-tile-body">
        <small>{work.releaseDate?.value ?? "DATE UNKNOWN"}</small>
        <strong>{work.code}</strong>
        <span>{localizeText(work.titles, "ja")}</span>
      </span>
    </button>
  );
}

function PersonTile({ person, onOpen }: { person: Person; onOpen: () => void }) {
  return (
    <button className="person-tile" onClick={onOpen}>
      <span className="avatar-placeholder">{getPreferredPersonName(person, "ja").slice(0, 1)}</span>
      <span><strong>{getPreferredPersonName(person, "ja")}</strong><small>{person.activityStatus}</small></span>
    </button>
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
  if (!relations.length) return null;
  return (
    <section className="settings-card">
      <span className="eyebrow">RELATIONS</span><h2>{title}</h2>
      <div className="people-inline">
        {relations.map((relation) => {
          const person = people.get(relation.personId);
          return <button key={`${relation.personId}-${relation.role}`} onClick={() => onOpen(relation.personId)}>{person ? getPreferredPersonName(person, "ja") : relation.personId}</button>;
        })}
      </div>
    </section>
  );
}

function nfoStatusLabel(status: NfoImportItemStatus): string {
  switch (status) {
    case "new_work": return "新 Work";
    case "existing_work": return "补充已有 Work";
    case "missing_code": return "缺少番号";
    case "missing_title": return "缺少标题";
    case "duplicate_code": return "重复番号";
    case "parse_error": return "解析失败";
  }
}

function nfoStatusClass(status: NfoImportItemStatus): string {
  return status === "new_work" || status === "existing_work" ? "status-chip ok" : "status-chip warn";
}

function assetStatusLabel(status: LocalAssetImportPreview["items"][number]["status"]): string {
  switch (status) {
    case "ready": return "可关联";
    case "pending_work": return "等待本轮 NFO 创建 Work";
    case "missing_code": return "缺少番号";
    case "work_not_found": return "找不到 Work";
    case "unknown_asset_type": return "未识别图片角色";
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
  if (!values.length) return <p className="muted">尚未配置。</p>;
  return <ul className="path-list">{values.map((path) => <li key={path}><code>{path}</code><button className="danger-button" onClick={() => onRemove(path)}>移除</button></li>)}</ul>;
}

function TokenList({ values }: { values: string[] }) {
  if (!values.length) return <p className="muted">暂无分类引用。</p>;
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
  return <section className="empty-state"><div className="loading-dot" /><strong>正在读取资料库…</strong></section>;
}

function ErrorState({ error }: { error: unknown }) {
  return <section className="empty-state error-state"><span className="eyebrow">READ ERROR</span><h2>无法读取当前页面</h2><p>{toMessage(error)}</p></section>;
}

function EmptyResults() {
  return <section className="empty-state"><strong>没有符合当前条件的数据。</strong></section>;
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

function organizationName(value?: Organization): string | undefined {
  return value ? localizeText(value.names, "ja") : undefined;
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
