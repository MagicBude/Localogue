import { useEffect, useRef, useState, type ReactNode } from "react";

import { MediaScanCoordinator } from "@/application/media/media-scan-coordinator";
import { findApprovedGenreAlias } from "@/application/services/genre-localization-service";
import { localizeText } from "@/application/services/localization-service";
import type { MediaScanJobSnapshot } from "@/domain/entities/media-scan";
import type { MediaFile } from "@/domain/entities/media-file";

import type { DesktopBootstrapSettings, DesktopMediaProbeResult, DesktopTaskProgress } from "./contracts";
import { DesktopAssetStorageGovernance } from "./desktop-asset-storage-governance";
import { useDesktopI18n } from "./desktop-i18n";
import { MediaBindingPanel } from "./desktop-management";
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
  type NfoImportItemStatus,
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

  // 使用 stale-while-refresh Hook：资料变化时保留旧列表，避免整个工作台闪烁并丢失滚动位置。
  const data = useStableAsyncData(async () => {
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
  // 兼容旧配置：专用 NFO / Media 路径中的图片也应参与发现。
  return unique([...settings.libraryRoots, ...settings.nfoScanPaths, ...settings.mediaScanPaths]);
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="section-title"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>;
}

function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></section>;
}

function InfoCard({ label, value }: { label: string; value?: string }) {
  return <article className="info-card"><span>{label}</span><strong>{value && value !== "—" ? value : "—"}</strong></article>;
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
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatBytes(value: number): string {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 2 ? 2 : 1)} ${units[index]}`;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function LoadingState() {
  const { t } = useDesktopI18n();
  return <section className="empty-state"><div className="loading-dot" /><strong>{t("正在读取资料库…")}</strong></section>;
}

function ErrorState({ error }: { error: unknown }) {
  const { t } = useDesktopI18n();
  return <section className="empty-state error-state"><span className="eyebrow">READ ERROR</span><h2>{t("无法读取当前页面")}</h2><p>{toMessage(error)}</p></section>;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
