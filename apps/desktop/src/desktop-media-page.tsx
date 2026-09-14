import { useEffect, useRef, useState } from "react";

import { MediaScanCoordinator } from "@/application/media/media-scan-coordinator";
import { discoverDesktopMetadataFiles } from "./desktop-metadata-discovery";
import type { MediaScanJobSnapshot } from "@/domain/entities/media-scan";
import type { MediaScanHistoryEntry } from "@/domain/entities/media-scan-history";
import type { MediaFile } from "@/domain/entities/media-file";

import type { DesktopBootstrapSettings, DesktopLibraryProfile, DesktopMediaProbeResult, DesktopTaskProgress } from "./contracts";
import { contentFolderRoots, normalizeContentFolders } from "./content-folders";
import { activeLibraryProfile } from "./library-profiles";
import { DesktopAssetStorageGovernance } from "./desktop-asset-storage-governance";
import { useDesktopI18n } from "./desktop-i18n";
import { DesktopReviewPage } from "./desktop-review-page";
import { MediaBindingPanel } from "./desktop-media-binding-panel";
import { MediaProbeSection, MediaScanHistorySection, MediaScanSection } from "./desktop-media-sections";
import { MediaLibrarySection } from "./desktop-media-library-section";
import { MetadataImportSection } from "./desktop-metadata-import-section";
import { VocabularyAuditSection } from "./desktop-vocabulary-audit-section";
import { PageTitle } from "./desktop-page-primitives";
import {
  importLocalAssetPreview,
  previewLocalAssetImport,
  type LocalAssetImportPreview,
  type LocalAssetImportResult,
} from "./local-asset-import";
import {
  importNfoPreview,
  previewNfoImport,
  saveNfoPreviewAsEvidence,
  type NfoImportPreview,
  type NfoImportResult,
} from "./nfo-library-import";
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
import { useStableAsyncData } from "./use-stable-async-data";
import { useUiConfirm } from "./ui/confirm-dialog";
import { UiButton } from "./ui/button";
import {
  applyVocabularyRepair,
  previewVocabularyRepair,
  type VocabularyRepairPreview,
  type VocabularyRepairResult,
} from "./vocabulary-repair";

const fileDialog = new TauriFileDialogAdapter();
const fileOpener = new TauriFileOpenerAdapter();
const mediaProbe = new TauriMediaProbeAdapter();
const fileSystem = new TauriFileSystemAdapter();
const fileHash = new TauriFileHashAdapter();

/**
 * Desktop 媒体工作台。
 *
 * 教学提示：
 * - React state 只保存页面交互与任务快照；
 * - 扫描规则由 MediaScanCoordinator 决定，页面不复制匹配算法；
 * - NFO、图片和词表修复分别调用 Application Service；
 * - 所有磁盘能力都经过最小 Tauri Adapter / Bridge。
 *
 * 这样划分后，更换页面布局不会改变扫描和写入规则，更换 Native 实现也不需要重写界面。
 */
export function DesktopMediaPage({
  repository,
  settings,
  setMessage,
  progress,
  onLibraryChanged,
  runtimeContractRevision,
  autoSyncRequest,
  onOpenSettings,
  onOpenLibrary,
  openWork,
}: {
  repository: TauriLibraryRepository;
  settings: DesktopBootstrapSettings;
  setMessage: (message: string) => void;
  progress: DesktopTaskProgress | null;
  onLibraryChanged: () => void;
  runtimeContractRevision: number;
  autoSyncRequest: number;
  onOpenSettings: () => void;
  onOpenLibrary: () => void;
  openWork: (id: string) => void;
}) {
  const { t } = useDesktopI18n();
  const confirm = useUiConfirm();
  const [scan, setScan] = useState<MediaScanJobSnapshot | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [probe, setProbe] = useState<DesktopMediaProbeResult | null>(null);
  const [probing, setProbing] = useState(false);
  const [nfoPreview, setNfoPreview] = useState<NfoImportPreview | null>(null);
  const [nfoResult, setNfoResult] = useState<NfoImportResult | null>(null);
  const [assetPreview, setAssetPreview] = useState<LocalAssetImportPreview | null>(null);
  const [assetResult, setAssetResult] = useState<LocalAssetImportResult | null>(null);
  const [metadataBusy, setMetadataBusy] = useState(false);
  const [syncStage, setSyncStage] = useState<"idle" | "discover" | "metadata" | "media" | "complete" | "error">("idle");
  const [syncingRoots, setSyncingRoots] = useState<string[]>([]);
  const [bindingMediaId, setBindingMediaId] = useState<string | null>(null);
  const [vocabularyPreview, setVocabularyPreview] = useState<VocabularyRepairPreview | null>(null);
  const [vocabularyResult, setVocabularyResult] = useState<VocabularyRepairResult | null>(null);
  const [vocabularyBusy, setVocabularyBusy] = useState(false);
  const [evidenceEpoch, setEvidenceEpoch] = useState(0);
  const scanCoordinator = useRef<MediaScanCoordinator | null>(null);
  const scanTimer = useRef<number | null>(null);
  const handledAutoSyncRequest = useRef(0);
  const recordedScanIds = useRef(new Set<string>());
  const mediaLibraryRef = useRef<HTMLDivElement | null>(null);
  const profile = activeLibraryProfile(settings);

  useEffect(() => () => {
    if (scanTimer.current !== null) window.clearInterval(scanTimer.current);
  }, []);

  const mediaRoots = effectiveMediaRoots(profile);
  const nfoRoots = effectiveNfoRoots(profile);
  const assetRoots = effectiveAssetRoots(profile);
  // 组合路径只计算一次，避免 JSX 为“是否为空”和“实际展示”重复做去重工作。
  const unifiedRoots = profile ? normalizeContentFolders(profile).map((folder) => folder.path) : [];
  const metadataRoots = unique([...nfoRoots, ...assetRoots]);

  // 使用 stale-while-refresh Hook：资料变化时保留旧列表，避免整个工作台闪烁并丢失滚动位置。
  const data = useStableAsyncData(async () => {
    const [media, works, assets, scanHistory] = await Promise.all([
      repository.listMediaFiles(),
      repository.listWorks({ page: 1, pageSize: 100000 }),
      repository.listAssets(),
      repository.listMediaScanHistory(),
    ]);
    return {
      media,
      works: new Map(works.items.map((item) => [item.id, item])),
      assets,
      scanHistory: scanHistory.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, 20),
    };
  }, [repository]);
  const unlinkedMediaCount = data.value?.media.filter((item) => !item.workId).length ?? 0;

  async function recordScanHistory(snapshot: MediaScanJobSnapshot): Promise<void> {
    if (["running", "cancelling"].includes(snapshot.status) || recordedScanIds.current.has(snapshot.id)) return;
    recordedScanIds.current.add(snapshot.id);
    const started = Date.parse(snapshot.startedAt);
    const finished = Date.parse(snapshot.finishedAt ?? new Date().toISOString());
    const entry: MediaScanHistoryEntry = {
      schemaVersion: 1,
      id: `media_scan_history_${snapshot.id}`,
      snapshot,
      durationMs: Number.isFinite(started) && Number.isFinite(finished) ? Math.max(0, finished - started) : 0,
      recordedAt: snapshot.finishedAt ?? new Date().toISOString(),
    };
    try {
      await repository.saveMediaScanHistory(entry);
    } catch (error) {
      // 允许后续重试；历史写入失败不改变已经完成的媒体扫描结果。
      recordedScanIds.current.delete(snapshot.id);
      throw error;
    }
  }

  async function startScan(options: { waitForCompletion?: boolean; roots?: string[]; nfoIdentityHints?: Array<{ path: string; code: string }> } = {}): Promise<MediaScanJobSnapshot | null> {
    if (!profile?.libraryPath) {
      setMessage(t("请先创建影片库并确认数据存储位置；社区资料不能保存本地视频记录。"));
      return null;
    }
    const requestedRoots = options.roots ?? mediaRoots;
    if (!requestedRoots.length) {
      setMessage(t("请先添加内容目录，或在高级设置里添加额外媒体目录。"));
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
        roots: requestedRoots,
        ffprobeExecutable: settings.ffprobePath?.trim() || "ffprobe",
        probeMedia: true,
        computeSha256: false,
        pruneMissing: true,
        // Unified Root 按文件扩展名分流：任何子目录中的视频都会被发现；图片由 Local Asset Ingest 单独处理，避免图片文件占用媒体发现上限。
        observeImageSidecars: false,
        ...(options.nfoIdentityHints?.length ? { nfoIdentityHints: options.nfoIdentityHints } : {}),
      });
      setScan(initial);
      setMessage(t("Desktop 增量媒体扫描已启动：将依次检查全部 {count} 个媒体根目录。", { count: requestedRoots.length }));

      if (scanTimer.current !== null) window.clearInterval(scanTimer.current);

      if (options.waitForCompletion) {
        scanTimer.current = window.setInterval(() => {
          setScan(coordinator.getSnapshot());
        }, 250);
        const final = await coordinator.waitForCompletion();
        if (scanTimer.current !== null) window.clearInterval(scanTimer.current);
        scanTimer.current = null;
        setScan(final);
        let historyError: unknown;
        if (final) {
          try { await recordScanHistory(final); }
          catch (error) { historyError = error; }
        }
        onLibraryChanged();
        if (historyError) {
          setMessage(t("扫描完成，但保存历史失败：{error}", { error: toMessage(historyError) }));
        } else if (final?.status === "completed") {
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
          void recordScanHistory(snapshot)
            .then(onLibraryChanged)
            .catch((error) => setMessage(t("扫描完成，但保存历史失败：{error}", { error: toMessage(error) })));
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
    if (!profile?.libraryPath) {
      setMessage(t("请先创建影片库并确认数据存储位置；NFO 和本地图片会写入当前影片库。"));
      return;
    }
    if (!nfoRoots.length && !assetRoots.length) {
      setMessage(t("请先添加内容目录，或配置高级 NFO / 视频目录。"));
      return;
    }

    setMetadataBusy(true);
    setSyncStage("discover");
    setNfoResult(null);
    setAssetResult(null);
    try {
      const discovery = await discoverDesktopMetadataFiles(nfoRoots, assetRoots);
      setSyncStage("metadata");
      const nfo = await previewNfoImport(nfoRoots, repository, discovery.nfoEntries);
      const assets = await previewLocalAssetImport(assetRoots, repository, nfo, discovery.assetEntries);
      setNfoPreview(nfo);
      setAssetPreview(assets);
      setMessage(t("资料源扫描完成：发现 {nfo} 个 NFO（{works} 个 Work 候选）和 {images} 张图片（{linkable} 张可关联）。", { nfo: nfo.discovered, works: nfo.importable, images: assets.discovered, linkable: assets.linkable }));
    } catch (error) {
      setSyncStage("error");
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
      setEvidenceEpoch((value) => value + 1);
      setMessage(`已保存 ${count} 条不可变 NFO Evidence；可继续在下方核对并应用。`);
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

  async function syncUnifiedLibrary(onlyRoots?: string[]): Promise<void> {
    const syncNfoRoots = onlyRoots ?? nfoRoots;
    const syncAssetRoots = onlyRoots ?? assetRoots;
    const syncMediaRoots = onlyRoots ?? mediaRoots;
    if (!profile?.libraryPath) {
      setMessage(t("请先创建影片库并确认数据存储位置；扫描需要保存作品、图片和视频记录。"));
      return;
    }
    if (!unique([...syncNfoRoots, ...syncAssetRoots, ...syncMediaRoots]).length) {
      setMessage(t("请先添加内容目录，或配置高级兼容目录。"));
      return;
    }
    if (metadataBusy || scan?.status === "running" || scan?.status === "cancelling") return;

    setSyncingRoots(unique([...syncNfoRoots, ...syncAssetRoots, ...syncMediaRoots]));
    setMetadataBusy(true);
    setNfoResult(null);
    setAssetResult(null);
    let nfoIdentityHints: Array<{ path: string; code: string }> = [];
    try {
      setMessage(t("正在扫描 NFO 和本地图片…"));
      const discovery = await discoverDesktopMetadataFiles(syncNfoRoots, syncAssetRoots);
      const nfoPreviewNext = await previewNfoImport(syncNfoRoots, repository, discovery.nfoEntries);
      nfoIdentityHints = buildNfoIdentityHints(nfoPreviewNext);
      setNfoPreview(nfoPreviewNext);

      let nfo: NfoImportResult | null = null;
      if (nfoPreviewNext.importable) {
        nfo = await importNfoPreview(nfoPreviewNext, repository, (value) => fileHash.sha256Text(value));
        setNfoResult(nfo);
      }

      // NFO 可能刚创建 Work；因此图片 Preview 故意放在 NFO Import 之后重新计算，
      // 让同一次“一键同步”里的 poster / cover 直接看到最新 Canonical Work。
      const assetPreviewNext = await previewLocalAssetImport(syncAssetRoots, repository, nfoPreviewNext, discovery.assetEntries);
      setAssetPreview(assetPreviewNext);
      let assets: LocalAssetImportResult | null = null;
      if (assetPreviewNext.linkable) {
        assets = await importLocalAssetPreview(assetPreviewNext, repository, (value) => fileHash.sha256Text(value));
        setAssetResult(assets);
      }

      onLibraryChanged();
      setMessage(t("元数据与图片已同步：NFO {nfo}；图片 {assets}。正在继续启动媒体增量扫描…", { nfo: nfo ? `${nfo.imported} / +${nfo.createdWorks} Work` : "—", assets: assets ? `${assets.imported} / +${assets.createdAssets} Asset` : `${assetPreviewNext.discovered} / ${assetPreviewNext.linkable} linkable` }));
    } catch (error) {
      setSyncingRoots([]);
      setMessage(t("资料库扫描失败：{error}", { error: toMessage(error) }));
      return;
    } finally {
      setMetadataBusy(false);
    }

    setSyncStage("media");
    const media = onlyRoots
      ? await startScan({ waitForCompletion: true, roots: syncMediaRoots, nfoIdentityHints })
      : await startScan({ waitForCompletion: true, nfoIdentityHints });
    setSyncingRoots([]);
    if (media?.status === "completed") {
      setSyncStage("complete");
      setMessage(t("资料库扫描完成：已检查 {roots} 个目录，发现 {files} 个视频。", { roots: media.result?.roots.length ?? 0, files: media.result?.discovered ?? 0 }));
    }
  }

  useEffect(() => {
    // 首页只发出同步意图。令牌必须严格变大才执行，普通重渲染和返回 Media 页都不会重复扫描。
    if (!autoSyncRequest || autoSyncRequest <= handledAutoSyncRequest.current) return;
    handledAutoSyncRequest.current = autoSyncRequest;
    void syncUnifiedLibrary();
    // syncUnifiedLibrary 读取的是本次渲染的完整页面状态；把所有局部函数列入依赖反而会让每次渲染重跑。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncRequest]);

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
    if (!await confirm({ title: t("确认"), description: t("应用分类修复？只重排 V1-16/17 NFO 自动生成的 Genre / Tag 引用，不会删除用户手工 Tag。"), confirmLabel: t("确认") })) return;
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
      <PageTitle eyebrow="IMPORT · ORGANIZE" title={t("导入与整理")} description={t("在同一工作台完成资料同步、预览导入和差异核对；日常操作从上往下处理，需要时再展开高级工具。")} />
      <DirectoryScanPanel roots={unifiedRoots} media={data.value?.media ?? []} history={data.value?.scanHistory ?? []} syncingRoots={syncingRoots} running={metadataBusy || scan?.status === "running" || scan?.status === "cancelling"} onManage={onOpenSettings} onSync={(root) => void syncUnifiedLibrary([root])} />
      <section className="settings-card unified-sync-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ONE ROOT · ONE ACTION</span>
            <h2>{t("扫描资料库")}</h2>
            <p className="muted">{t("一次检查作品资料、封面图片和视频文件；新增内容会自动加入当前资料库。")}</p>
          </div>
          <button className="primary-button sync-library-button" disabled={metadataBusy || scan?.status === "running" || scan?.status === "cancelling"} onClick={() => void syncUnifiedLibrary()}>
            {metadataBusy || scan?.status === "running" ? t("扫描中…") : t("扫描资料库")}
          </button>
        </div>
        <code className="path-block">{unifiedRoots.length ? unifiedRoots.join("\n") : t("尚未配置内容目录；仍可使用下方高级媒体 / NFO 目录。")}</code>
        {syncStage !== "idle" ? (
          <div className={`unified-sync-progress is-${syncStage}`} role="status" aria-live="polite">
            {["discover", "metadata", "media", "complete"].map((stage, index) => {
              const labels = [t("发现文件"), t("导入资料与图片"), t("扫描视频"), t("完成")];
              const current = ["discover", "metadata", "media", "complete"].indexOf(syncStage);
              return <div className={index < current || syncStage === "complete" ? "is-done" : index === current ? "is-current" : ""} key={stage}><span>{index < current || syncStage === "complete" ? "✓" : index + 1}</span><strong>{labels[index]}</strong></div>;
            })}
            {syncStage === "error" ? <p>{t("同步失败，请查看上方错误信息后重试。")}</p> : null}
            {syncStage === "media" && scan ? <p>{scan.progress.message} · {scan.progress.current} / {scan.progress.total}</p> : null}
          </div>
        ) : null}
        {syncStage === "complete" ? <div className="button-row unified-sync-next-actions">
          <UiButton variant="primary" onClick={onOpenLibrary}>{t("查看作品库")}</UiButton>
          {unlinkedMediaCount ? <UiButton onClick={() => mediaLibraryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>{t("处理 {count} 个未关联媒体", { count: unlinkedMediaCount })}</UiButton> : null}
        </div> : null}
      </section>
      <MediaScanSection
        roots={mediaRoots}
        scan={scan}
        onStart={() => void startScan()}
        onCancel={() => setScan(scanCoordinator.current?.cancel() ?? null)}
      />
      <MediaScanHistorySection entries={data.value?.scanHistory ?? []} />

      <MetadataImportSection
        roots={metadataRoots}
        busy={metadataBusy}
        nfoPreview={nfoPreview}
        assetPreview={assetPreview}
        nfoResult={nfoResult}
        assetResult={assetResult}
        onPreview={() => void scanMetadataSource()}
        onSaveEvidence={() => void saveMetadataAsEvidence()}
        onImport={() => void importMetadataSource()}
      />

      <section className="organize-review-section">
        <div className="section-heading organize-section-heading"><div><span className="eyebrow">REVIEW</span><h2>{t("核对需要判断的资料")}</h2><p className="muted">{t("只有保存为待审核资料的来源内容才会出现在这里；明确无冲突的本地导入不需要重复审核。")}</p></div><button className="ghost-button" type="button" onClick={onOpenLibrary}>{t("查看作品库")}</button></div>
        <DesktopReviewPage repository={repository} onLibraryChanged={onLibraryChanged} setMessage={setMessage} openWork={openWork} embedded reloadSignal={evidenceEpoch} />
      </section>

      <VocabularyAuditSection
        busy={vocabularyBusy}
        preview={vocabularyPreview}
        result={vocabularyResult}
        onPreview={() => void auditVocabulary()}
        onApply={() => void repairVocabulary()}
      />

      <MediaProbeSection
        selectedPath={selectedPath}
        probing={probing}
        progress={progress}
        probe={probe}
        onChoose={() => void chooseAndProbe()}
        onOpen={() => void fileOpener.openPath(selectedPath)}
        onReveal={() => void fileOpener.revealInFolder(selectedPath)}
      />

      <div ref={mediaLibraryRef} className="media-library-anchor">
      <MediaLibrarySection
        loading={data.loading}
        error={data.error}
        media={data.value?.media}
        works={data.value?.works}
        assetCount={data.value?.assets.length}
        bindingMediaId={bindingMediaId}
        onOpen={(path) => void fileOpener.openPath(path)}
        onReveal={(path) => void fileOpener.revealInFolder(path)}
        onToggleBinding={(id) => setBindingMediaId((current) => current === id ? null : id)}
      />
      </div>

      <DesktopAssetStorageGovernance
        hasPrivateLibrary={Boolean(profile?.libraryPath)}
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
function buildNfoIdentityHints(preview: NfoImportPreview): Array<{ path: string; code: string }> {
  return preview.items.flatMap((item) => item.code ? [{ path: item.path, code: item.code }] : []);
}

/**
 * 内容目录是 Profile 配置，扫描统计由 MediaFile 与 Receipt 派生。
 * 这样先交付 JavBoss 式逐目录操作，又不把本机目录误建成 Canonical 实体。
 */
function DirectoryScanPanel({ roots, media, history, syncingRoots, running, onManage, onSync }: {
  roots: string[];
  media: MediaFile[];
  history: MediaScanHistoryEntry[];
  syncingRoots: string[];
  running: boolean;
  onManage: () => void;
  onSync: (path: string) => void;
}) {
  const { t } = useDesktopI18n();
  return <section className="settings-card directory-manager-card">
    <div className="section-heading"><div><span className="eyebrow">DIRECTORY SCAN</span><h2>{t("按目录扫描")}</h2><p className="muted">{t("只检查选中的内容目录；其他目录不会参与本轮扫描。")}</p></div><button type="button" onClick={onManage}>{t("管理内容目录")}</button></div>
    {roots.length ? <div className="directory-card-list">{roots.map((root) => {
      const files = media.filter((item) => item.scanRoot && samePath(item.scanRoot, root));
      const linked = files.filter((item) => item.workId).length;
      const last = history.find((entry) => entry.snapshot.result?.roots.some((item) => samePath(item, root)));
      const isCurrent = syncingRoots.some((item) => samePath(item, root));
      const status = isCurrent ? "running" : last?.snapshot.status ?? "idle";
      return <article key={root}>
        <div className="directory-card-main">
          <div className="directory-card-title"><strong title={root}>{root}</strong><span className={`directory-status is-${status}`}>{directoryStatusLabel(status, t)}</span></div>
          <div className="desktop-dense-chips"><span>{t("视频")} {files.length}</span><span>{t("已关联")} {linked}</span><span>{t("未关联")} {files.length - linked}</span>{last?.snapshot.result ? <><span>{t("新增")} {last.snapshot.result.added}</span><span>{t("已更新")} {last.snapshot.result.updated}</span></> : null}</div>
          {last ? <small>{t("上次扫描：{time}", { time: new Date(last.recordedAt).toLocaleString() })} · {t("耗时 {duration}", { duration: formatDirectoryDuration(last.durationMs) })}</small> : <small>{t("尚未扫描")}</small>}
          {last?.snapshot.error ? <small className="directory-card-error">{last.snapshot.error}</small> : null}
        </div>
        <button className="primary-button" disabled={running} type="button" onClick={() => onSync(root)}>{t("扫描此目录")}</button>
      </article>;
    })}</div> : <p className="muted">{t("尚未添加内容目录。")}</p>}
  </section>;
}

function directoryStatusLabel(status: MediaScanHistoryEntry["snapshot"]["status"] | "idle", t: (source: string) => string): string {
  switch (status) {
    case "running": return t("扫描中");
    case "cancelling": return t("正在取消");
    case "completed": return t("已完成");
    case "cancelled": return t("已取消");
    case "failed": return t("失败");
    default: return t("空闲");
  }
}

function formatDirectoryDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string) => value.replaceAll("\\", "/").replace(/\/+$/, "").toLocaleLowerCase();
  return normalize(left) === normalize(right);
}

function effectiveMediaRoots(profile: DesktopLibraryProfile | null): string[] {
  return profile ? contentFolderRoots(profile, "video") : [];
}

function effectiveNfoRoots(profile: DesktopLibraryProfile | null): string[] {
  return profile ? contentFolderRoots(profile, "nfo") : [];
}

function effectiveAssetRoots(profile: DesktopLibraryProfile | null): string[] {
  return profile ? contentFolderRoots(profile, "images") : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

