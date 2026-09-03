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

const fileDialog = new TauriFileDialogAdapter();
const fileOpener = new TauriFileOpenerAdapter();
const mediaProbe = new TauriMediaProbeAdapter();
const fileSystem = new TauriFileSystemAdapter();
const fileHash = new TauriFileHashAdapter();

const DEFAULT_SETTINGS: DesktopBootstrapSettings = {
  schemaVersion: 1,
  mediaScanPaths: [],
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
      setMessage("Desktop 实例设置已保存；资料源、Shared Packs 与媒体目录已经重新加载。");
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
            <small>Desktop · V1-15</small>
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
            <span className="eyebrow">DESKTOP FEATURE PARITY I</span>
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
            />
          ) : (
            <WorksPage repository={repository} openWork={openWork} />
          )
        ) : page === "people" ? (
          detail?.kind === "person" ? (
            <PersonDetailPage
              repository={repository}
              id={detail.id}
              onBack={() => setDetail(null)}
              openWork={openWork}
            />
          ) : (
            <PeoplePage repository={repository} openPerson={openPerson} />
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
            privateLibraryPath={savedSettings.libraryPath}
            packInfos={packInfos}
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
          V1-15 开始，Desktop 不再只是 Runtime 测试壳。首页、作品、人物、媒体、资料包与设置
          直接读取和 Web 相同的数据模型，并共享查询规则。
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

function WorksPage({ repository, openWork }: { repository: LibraryRepository; openWork: (id: string) => void }) {
  const [text, setText] = useState("");
  const data = useAsyncData(
    () => repository.listWorks({ text: text || undefined, page: 1, pageSize: 1000, sort: "release_desc" }),
    [repository, text],
  );

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="CANONICAL WORKS"
        title="作品库"
        description="Desktop 与 Web 共用 WorkQuery：番号/标题搜索、排序与 Facet 语义保持一致。"
      />
      <label className="search-box">
        <span>搜索番号或标题</span>
        <input value={text} onChange={(event: ChangeEvent<HTMLInputElement>) => setText(event.target.value)} placeholder="例如 ABC-001 / タイトル" />
      </label>
      {data.loading ? <LoadingState /> : data.error || !data.value ? <ErrorState error={data.error} /> : (
        <>
          <div className="result-meta"><strong>{data.value.total}</strong> 项作品</div>
          <div className="work-grid">
            {data.value.items.map((work) => <WorkTile key={work.id} work={work} onOpen={() => openWork(work.id)} />)}
          </div>
          {!data.value.items.length ? <EmptyResults /> : null}
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
}: {
  repository: LibraryRepository;
  id: string;
  onBack: () => void;
  openPerson: (id: string) => void;
}) {
  const data = useAsyncData(async () => {
    const work = await repository.findWorkById(id);
    if (!work) return null;
    const [people, organizations, series, media] = await Promise.all([
      repository.listPeople({ page: 1, pageSize: 99999 }),
      repository.listOrganizations(),
      repository.listSeries(),
      repository.listMediaFiles(work.id),
    ]);
    return {
      work,
      people: new Map(people.items.map((item) => [item.id, item])),
      organizations: new Map(organizations.map((item) => [item.id, item])),
      series: new Map(series.map((item) => [item.id, item])),
      media,
    };
  }, [repository, id]);

  if (data.loading) return <LoadingState />;
  if (data.error || !data.value) return data.value === null ? <ErrorState error="作品不存在。" /> : <ErrorState error={data.error} />;
  const { work, people, organizations, series, media } = data.value;

  const performers = work.personRelations.filter((item) => item.role === "performer");
  const directors = work.personRelations.filter((item) => item.role === "director");

  return (
    <div className="page-stack">
      <button className="back-button" onClick={onBack}>← 返回作品库</button>
      <section className="detail-hero">
        <div className="code-badge">{work.code}</div>
        <h1>{localizeText(work.titles, "ja")}</h1>
        <p>{localizeText(work.descriptions, "zh-CN", "暂无简介")}</p>
      </section>
      <section className="detail-grid">
        <InfoCard label="发行日期" value={work.releaseDate?.value} />
        <InfoCard label="时长" value={work.durationMinutes ? `${work.durationMinutes} 分钟` : undefined} />
        <InfoCard label="厂商" value={organizationName(organizations.get(work.makerId ?? ""))} />
        <InfoCard label="厂牌" value={organizationName(organizations.get(work.labelId ?? ""))} />
        <InfoCard label="Series" value={work.seriesIds.map((seriesId) => localizeText(series.get(seriesId)?.names, "ja")).filter((value) => value !== "—").join(" · ") || undefined} />
        <InfoCard label="本地媒体" value={`${media.length} 个文件`} />
      </section>
      <DetailPeople title="演员" relations={performers} people={people} onOpen={openPerson} />
      <DetailPeople title="导演" relations={directors} people={people} onOpen={openPerson} />
      <section className="settings-card">
        <span className="eyebrow">CLASSIFICATION</span>
        <h2>分类引用</h2>
        <TokenList values={[...work.workTypeIds, ...work.genreIds, ...work.tagIds]} />
      </section>
    </div>
  );
}

function PeoplePage({ repository, openPerson }: { repository: LibraryRepository; openPerson: (id: string) => void }) {
  const [text, setText] = useState("");
  const data = useAsyncData(
    () => repository.listPeople({ text: text || undefined, page: 1, pageSize: 1000, sort: "name_asc" }),
    [repository, text],
  );

  return (
    <div className="page-stack">
      <PageTitle eyebrow="CANONICAL PEOPLE" title="人物库" description="正式名、译名、罗马字、别名和旧艺名都进入与 Web 相同的搜索范围。" />
      <label className="search-box">
        <span>搜索人物</span>
        <input value={text} onChange={(event: ChangeEvent<HTMLInputElement>) => setText(event.target.value)} placeholder="姓名 / 别名 / 旧艺名" />
      </label>
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
}: {
  repository: LibraryRepository;
  id: string;
  onBack: () => void;
  openWork: (id: string) => void;
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
  repository: LibraryRepository;
  settings: DesktopBootstrapSettings;
  setMessage: (message: string) => void;
  progress: DesktopTaskProgress | null;
  onLibraryChanged: () => void;
}) {
  const [scan, setScan] = useState<MediaScanJobSnapshot | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [probe, setProbe] = useState<DesktopMediaProbeResult | null>(null);
  const [probing, setProbing] = useState(false);
  const scanCoordinator = useRef<MediaScanCoordinator | null>(null);
  const scanTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (scanTimer.current !== null) window.clearInterval(scanTimer.current);
  }, []);

  const data = useAsyncData(async () => {
    const [media, works] = await Promise.all([
      repository.listMediaFiles(),
      repository.listWorks({ page: 1, pageSize: 100000 }),
    ]);
    return { media, works: new Map(works.items.map((item) => [item.id, item])) };
  }, [repository]);

  async function startScan(): Promise<void> {
    if (!settings.libraryPath) {
      setMessage("请先在设置页选择 Private Library。Shared Pack 不能保存 MediaFile。 ");
      return;
    }
    if (!settings.mediaScanPaths.length) {
      setMessage("请先在设置页添加至少一个媒体扫描目录。");
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
          roots: settings.mediaScanPaths,
          ffprobeExecutable: settings.ffprobePath?.trim() || "ffprobe",
          probeMedia: true,
          computeSha256: false,
          pruneMissing: true,
        }),
      );
      setMessage("Desktop 增量媒体扫描已启动；Shared Pack 中的 Work 也参与匹配。 ");
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
      <PageTitle eyebrow="LOCAL · MEDIAFILE · FFPROBE" title="本地媒体" description="MediaFile 属于 Private Layer；作品事实仍来自 Canonical Library / Shared Packs。" />
      <section className="settings-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">INCREMENTAL SCAN</span>
            <h2>媒体扫描</h2>
            <p className="muted">复用 V1-12 MediaScanCoordinator，未变化文件会跳过昂贵分析。</p>
          </div>
          <div className="button-row">
            <button className="primary-button" disabled={scan?.status === "running" || scan?.status === "cancelling"} onClick={() => void startScan()}>开始扫描</button>
            <button disabled={scan?.status !== "running"} onClick={() => setScan(scanCoordinator.current?.cancel() ?? null)}>取消</button>
          </div>
        </div>
        {scan ? <div className={`progress ${scan.status}`}><strong>{scan.status} · {scan.progress.phase}</strong><span>{scan.progress.message}</span><span>{scan.progress.current} / {scan.progress.total}</span></div> : null}
        {scan?.result ? <div className="mini-stat-grid">
          <MiniStat label="Discovered" value={scan.result.discovered} />
          <MiniStat label="Added" value={scan.result.added} />
          <MiniStat label="Updated" value={scan.result.updated} />
          <MiniStat label="Unchanged" value={scan.result.unchanged} />
          <MiniStat label="Removed" value={scan.result.removed} />
        </div> : null}
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
          <div className="section-heading"><div><span className="eyebrow">MEDIA FILES</span><h2>{data.value.media.length} 个本地文件</h2></div></div>
          {data.value.media.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>文件</th><th>Work</th><th>大小</th><th>媒体参数</th><th>操作</th></tr></thead><tbody>
            {data.value.media.map((file) => {
              const work = file.workId ? data.value!.works.get(file.workId) : undefined;
              return <tr key={file.id}>
                <td><strong>{file.fileName}</strong><small className="path-text">{file.path}</small></td>
                <td>{work ? <><strong>{work.code}</strong><small>{localizeText(work.titles, "ja")}</small></> : <span className="status-chip warn">未绑定</span>}</td>
                <td>{formatBytes(file.fileSize ?? 0)}</td>
                <td>{mediaSummary(file)}</td>
                <td><div className="row-actions"><button onClick={() => void fileOpener.openPath(file.path)}>打开</button><button onClick={() => void fileOpener.revealInFolder(file.path)}>定位</button></div></td>
              </tr>;
            })}
          </tbody></table></div> : <p className="muted">尚未扫描到本地媒体。</p>}
        </section>
      )}
    </div>
  );
}

function PacksPage({
  privateLibraryPath,
  packInfos,
  onOpenSettings,
}: {
  privateLibraryPath?: string;
  packInfos: DesktopSharedPackInfo[];
  onOpenSettings: () => void;
}) {
  return (
    <div className="page-stack">
      <PageTitle eyebrow="SHARED · PRIVATE · PRIORITY" title="资料包" description="读取优先级与 Web 相同：Private Library > Shared Pack 1 > Shared Pack 2 > …；Shared Pack 永远只读。" />
      <section className="settings-card">
        <span className="eyebrow">SOURCE PRIORITY</span>
        <h2>当前资料源</h2>
        <ol className="source-priority-list">
          {privateLibraryPath ? <li><span className="source-index">1</span><div><strong>Private Library</strong><code>{privateLibraryPath}</code></div><span className="status-chip ok">WRITABLE</span></li> : null}
          {packInfos.map((pack, index) => (
            <li key={`${pack.configuredPath}-${index}`}>
              <span className="source-index">{index + (privateLibraryPath ? 2 : 1)}</span>
              <div><strong>{pack.name ?? pack.configuredPath}</strong><code>{pack.libraryPath ?? pack.absolutePath}</code><small>{pack.valid ? `${pack.id} · ${pack.version}${pack.license ? ` · ${pack.license}` : ""}` : pack.error}</small></div>
              <span className={pack.valid ? "status-chip ok" : "status-chip warn"}>{pack.valid ? "READ ONLY" : "CHECK"}</span>
            </li>
          ))}
        </ol>
        {!privateLibraryPath && !packInfos.length ? <p className="muted">当前没有配置资料源。</p> : null}
        <button className="primary-button" onClick={onOpenSettings}>管理资料源</button>
      </section>
      <section className="settings-card soft-card">
        <span className="eyebrow">V1-15 SCOPE</span>
        <h2>Desktop 现在已经理解 Shared Pack</h2>
        <p>
          Rust 会验证 <code>localogue-pack.json</code>、<code>schemaVersion=1</code>、
          <code>kind=shared-library</code> 与 <code>library/</code> 目录。有效 Pack 才会进入 Desktop Repository。
        </p>
        <p className="muted">Portable Pack 导入/导出与治理写入属于 V1-16 的交互对齐，不在这一版偷偷复制一套实现。</p>
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

  async function addMediaRoot(): Promise<void> {
    const path = await fileDialog.pickDirectory();
    if (!path) return;
    setSettings((current) => ({ ...current, mediaScanPaths: unique([...current.mediaScanPaths, path]) }));
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

      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">SHARED PACKS</span><h2>只读共享资料</h2></div><button onClick={() => void addSharedPack()}>+ 挂载资料包</button></div>
        <PathList values={settings.sharedPackPaths} onRemove={(path) => setSettings((current) => ({ ...current, sharedPackPaths: current.sharedPackPaths.filter((item) => item !== path) }))} />
        {packInfos.length ? <p className="muted">当前已保存配置中：{packInfos.filter((item) => item.valid).length} 个有效，{packInfos.filter((item) => !item.valid).length} 个需要检查。</p> : null}
      </section>

      <section className="settings-card">
        <div className="section-heading"><div><span className="eyebrow">MEDIA ROOTS</span><h2>媒体扫描目录</h2></div><button onClick={() => void addMediaRoot()}>+ 添加目录</button></div>
        <PathList values={settings.mediaScanPaths} onRemove={(path) => setSettings((current) => ({ ...current, mediaScanPaths: current.mediaScanPaths.filter((item) => item !== path) }))} />
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
