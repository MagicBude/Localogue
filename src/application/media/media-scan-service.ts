import type { PlatformFileEntry, PlatformServices } from "@/application/platform/platform-ports";
import type { InstanceSettings } from "@/domain/entities/instance-settings";
import type { MediaFile, MediaSidecarObservation } from "@/domain/entities/media-file";
import type { MediaScanProgress, MediaScanResult } from "@/domain/entities/media-scan";
import type { Work } from "@/domain/entities/work";
import type { LibraryRepository } from "@/domain/repositories/library-repository";

const videoExtensions = new Set([
  ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".m4v", ".ts", ".mts", ".m2ts", ".webm", ".flv",
]);
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const discoveryExtensions = [...videoExtensions, ".nfo", ...imageExtensions];
const MAX_DISCOVERED_VIDEOS = 5000;
const MAX_DISCOVERED_ENTRIES = 25000;

export interface MediaScanOptions {
  computeSha256?: boolean;
  probeMedia?: boolean;
  pruneMissing?: boolean;
  /** Desktop Unified Root 可关闭旧式图片 sidecar discovery；图片改由 Asset Ingest 单独处理。目录名没有扫描语义，任何子目录中的受支持视频仍会被发现。 */
  observeImageSidecars?: boolean;
}

export interface MediaScanRequest extends MediaScanOptions {
  roots: string[];
  ffprobeExecutable: string;
}

export interface MediaScanHooks {
  signal?: AbortSignal;
  onProgress?: (progress: MediaScanProgress) => void;
}

/**
 * 把实例设置转换为平台无关的扫描请求。
 *
 * 路径解析由 FileSystemPort 完成，因此 Application 层不需要依赖 node:path。
 * V1-17 中 libraryRoots 是首选统一资料源；mediaScanPaths 仍作为高级/兼容补充目录。
 * Tauri 和 Web 都复用这一语义，避免两个端对同一设置字段产生不同理解。
 */
export function createMediaScanRequestFromSettings(
  settings: InstanceSettings,
  platform: PlatformServices,
  options: MediaScanOptions = {},
): MediaScanRequest {
  const roots = Array.from(new Map([...(settings.libraryRoots ?? []), ...(settings.mediaScanPaths ?? [])]
    .map((item) => platform.fileSystem.resolvePath(item))
    .map((item) => [platform.fileSystem.normalizePathForIdentity(item), item] as const)).values());
  return {
    roots,
    ffprobeExecutable: settings.ffprobePath?.trim() || "ffprobe",
    probeMedia: options.probeMedia !== false,
    computeSha256: Boolean(options.computeSha256),
    pruneMissing: options.pruneMissing !== false,
    observeImageSidecars: options.observeImageSidecars !== false,
  };
}

/**
 * 平台无关的增量媒体扫描核心。
 *
 * V1-12 的关键变化：
 * - 不再让 Application Service 直接 import fs/path/child_process；
 * - 使用 size + mtime 判断视频是否改变；
 * - 未改变的视频不会重复 ffprobe / SHA-256；
 * - NFO / Poster / Fanart 作为 Sidecar Observation 独立比较；
 * - manual Work 绑定永远优先于扫描器番号匹配；
 * - 支持 AbortSignal 和阶段进度，为 Tauri 后台任务预留同一接口。
 */
export async function scanMediaLibrary(
  repository: LibraryRepository,
  request: MediaScanRequest,
  platform: PlatformServices,
  hooks: MediaScanHooks = {},
): Promise<MediaScanResult> {
  const { fileSystem, fileHash, mediaProbe } = platform;
  const signal = hooks.signal;
  const warnings: string[] = [];
  const successfulRoots: string[] = [];
  const discoveredEntries: Array<PlatformFileEntry & { scanRoot: string }> = [];

  emit(hooks, { phase: "preparing", current: 0, total: request.roots.length, message: "准备媒体扫描目录" });
  if (!request.roots.length) throw new Error("请先在设置页配置至少一个媒体扫描目录。");

  for (let index = 0; index < request.roots.length; index += 1) {
    throwIfAborted(signal);
    const root = request.roots[index];
    emit(hooks, {
      phase: "discovering",
      current: index,
      total: request.roots.length,
      message: `扫描目录 ${root}`,
    });
    try {
      const info = await fileSystem.stat(root, signal);
      if (!info.isDirectory) throw new Error("不是目录");
      const entries = await fileSystem.walkFiles(root, {
        extensions: request.observeImageSidecars === false ? [...videoExtensions] : discoveryExtensions,
        includeHidden: false,
        maxFiles: MAX_DISCOVERED_ENTRIES,
        signal,
      });
      successfulRoots.push(root);
      discoveredEntries.push(...entries.map((entry) => ({ ...entry, scanRoot: root })));
      if (entries.length >= MAX_DISCOVERED_ENTRIES) {
        warnings.push(`目录 ${root} 达到 ${MAX_DISCOVERED_ENTRIES} 个相关文件的 V1 扫描上限；建议拆分扫描根目录。`);
      }
    } catch (error) {
      if (isAbortError(error)) throw error;
      warnings.push(`无法扫描 ${root}: ${message(error)}`);
    }
  }

  if (!successfulRoots.length) throw new Error("没有可读取的媒体扫描目录。");
  emit(hooks, {
    phase: "discovering",
    current: request.roots.length,
    total: request.roots.length,
    message: "目录发现完成",
  });

  const deduplicatedEntries = deduplicateDiscoveredEntries(discoveredEntries, platform);
  const videoEntries = deduplicatedEntries
    .filter((entry) => videoExtensions.has(entry.extension))
    .sort((a, b) => a.path.localeCompare(b.path, "en"));
  const processedVideos = videoEntries.slice(0, MAX_DISCOVERED_VIDEOS);
  if (videoEntries.length > MAX_DISCOVERED_VIDEOS) {
    warnings.push(`本次发现 ${videoEntries.length} 个视频，只处理前 ${MAX_DISCOVERED_VIDEOS} 个；V1 增量扫描暂设安全上限。`);
  }

  const sidecarIndex = createSidecarEntryIndex(deduplicatedEntries, platform);
  const [workResult, existing] = await Promise.all([
    repository.listWorks({ page: 1, pageSize: 100000 }),
    repository.listMediaFiles(),
  ]);
  const works = workResult.items;
  const existingById = new Map(existing.map((item) => [item.id, item]));
  const scannedIds = new Set<string>();
  const pendingWrites: Array<{ media: MediaFile; isNew: boolean }> = [];
  let matched = 0;
  let unmatched = 0;
  let unchanged = 0;
  let probed = 0;
  let hashed = 0;
  let sidecarUpdated = 0;
  let ffprobeUnavailable = false;

  emit(hooks, {
    phase: "comparing",
    current: 0,
    total: processedVideos.length,
    message: "比较磁盘快照与现有 MediaFile",
  });

  for (let index = 0; index < processedVideos.length; index += 1) {
    throwIfAborted(signal);
    const entry = processedVideos[index];
    const normalizedPath = fileSystem.normalizePathForIdentity(entry.path);
    const id = `media_${fileHash.sha256Text(normalizedPath).slice(0, 24)}`;
    scannedIds.add(id);
    const previous = existingById.get(id);
    const videoChanged = !previous
      || previous.fileSize !== entry.size
      || previous.fileModifiedAt !== entry.modifiedAt;
    const sidecars = observeSidecars(entry, sidecarIndex, platform);
    const sidecarChanged = !sameSidecars(previous?.sidecars, sidecars);

    const codeMatch = matchWorkByCode(works, entry.path, platform);
    const binding = resolveBinding(previous, codeMatch);
    if (binding.workId) matched += 1;
    else unmatched += 1;
    const bindingChanged = previous?.workId !== binding.workId
      || previous?.matchMethod !== binding.matchMethod;

    emit(hooks, {
      phase: "analyzing",
      current: index + 1,
      total: processedVideos.length,
      fileName: entry.name,
      message: videoChanged ? "分析新增或修改的视频" : "增量快速路径",
    });

    const needsProbe = request.probeMedia !== false
      && !ffprobeUnavailable
      && (!previous || videoChanged || !previous.analyzedAt || previous.analysisStale === true);
    const needsHash = Boolean(request.computeSha256)
      && (!previous?.sha256 || videoChanged);

    let probeSucceeded = false;
    let probe = previous ? readPreviousProbe(previous) : {};
    if (needsProbe) {
      try {
        probe = await mediaProbe.probe(request.ffprobeExecutable, entry.path, signal);
        probeSucceeded = true;
        probed += 1;
      } catch (error) {
        if (isAbortError(error)) throw error;
        if (mediaProbe.isExecutableMissing(error)) ffprobeUnavailable = true;
        warnings.push(`ffprobe ${entry.name}: ${message(error)}`);
      }
    }

    let sha256: string | undefined;
    if (!videoChanged) sha256 = previous?.sha256;
    if (needsHash) {
      sha256 = await fileHash.sha256File(entry.path, signal);
      hashed += 1;
    }

    const technicalStateChanged = videoChanged || probeSucceeded || needsHash;
    const needsSave = !previous || bindingChanged || sidecarChanged || technicalStateChanged;
    if (!needsSave) {
      unchanged += 1;
      emit(hooks, {
        phase: "comparing",
        current: index + 1,
        total: processedVideos.length,
        fileName: entry.name,
        message: "未变化，跳过 ffprobe / Hash / JSON 写入",
      });
      continue;
    }

    const now = new Date().toISOString();
    const analysisStale = probeSucceeded
      ? false
      : previous?.analysisStale === true || (videoChanged && Boolean(previous?.analyzedAt || hasProbeValues(previous)));
    const media: MediaFile = {
      schemaVersion: 1,
      id,
      ...(binding.workId ? { workId: binding.workId } : {}),
      ...(binding.matchMethod ? { matchMethod: binding.matchMethod } : {}),
      path: entry.path,
      fileName: entry.name,
      extension: entry.extension,
      fileSize: entry.size,
      fileModifiedAt: entry.modifiedAt,
      scanRoot: entry.scanRoot,
      ...probe,
      ...(sha256 ? { sha256 } : {}),
      ...(analysisStale ? { analysisStale: true } : {}),
      ...(hasSidecars(sidecars) ? { sidecars } : {}),
      ...(probeSucceeded ? { analyzedAt: now } : previous?.analyzedAt ? { analyzedAt: previous.analyzedAt } : {}),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    pendingWrites.push({ media, isNew: !previous });
    if (sidecarChanged) sidecarUpdated += 1;
  }

  let added = 0;
  let updated = 0;
  emit(hooks, {
    phase: "persisting",
    current: 0,
    total: pendingWrites.length,
    message: "保存发生变化的 MediaFile",
  });
  for (let index = 0; index < pendingWrites.length; index += 1) {
    throwIfAborted(signal);
    const pending = pendingWrites[index];
    await repository.saveMediaFile(pending.media);
    if (pending.isNew) added += 1;
    else updated += 1;
    emit(hooks, {
      phase: "persisting",
      current: index + 1,
      total: pendingWrites.length,
      fileName: pending.media.fileName,
    });
  }

  let removed = 0;
  if (request.pruneMissing !== false) {
    const candidates = existing.filter((item) => item.scanRoot
      && successfulRoots.some((root) => fileSystem.samePath(root, item.scanRoot as string))
      && !scannedIds.has(item.id));
    emit(hooks, {
      phase: "pruning",
      current: 0,
      total: candidates.length,
      message: "清理已经不存在的本地媒体记录",
    });
    for (let index = 0; index < candidates.length; index += 1) {
      throwIfAborted(signal);
      const item = candidates[index];
      if (!(await fileSystem.exists(item.path, signal))) {
        await repository.deleteMediaFile(item.id);
        removed += 1;
      }
      emit(hooks, {
        phase: "pruning",
        current: index + 1,
        total: candidates.length,
        fileName: item.fileName,
      });
    }
  }

  const result: MediaScanResult = {
    roots: successfulRoots,
    discovered: processedVideos.length,
    added,
    updated,
    unchanged,
    saved: added + updated,
    matched,
    unmatched,
    removed,
    probed,
    hashed,
    sidecarUpdated,
    warnings,
  };
  emit(hooks, {
    phase: "completed",
    current: processedVideos.length,
    total: processedVideos.length,
    message: "媒体增量扫描完成",
  });
  return result;
}


function deduplicateDiscoveredEntries(
  entries: Array<PlatformFileEntry & { scanRoot: string }>,
  platform: PlatformServices,
): Array<PlatformFileEntry & { scanRoot: string }> {
  const byPath = new Map<string, PlatformFileEntry & { scanRoot: string }>();
  for (const entry of entries) {
    const key = platform.fileSystem.normalizePathForIdentity(entry.path);
    const previous = byPath.get(key);
    // 扫描根目录发生重叠时只保留一次，并让更具体的根目录负责这个文件。
    if (!previous || entry.scanRoot.length > previous.scanRoot.length) byPath.set(key, entry);
  }
  return [...byPath.values()];
}

interface SidecarEntryIndex {
  byDirectory: Map<string, PlatformFileEntry[]>;
  extrafanartByParentDirectory: Map<string, PlatformFileEntry[]>;
}

function createSidecarEntryIndex(
  entries: PlatformFileEntry[],
  platform: PlatformServices,
): SidecarEntryIndex {
  const byDirectory = new Map<string, PlatformFileEntry[]>();
  const extrafanartByParentDirectory = new Map<string, PlatformFileEntry[]>();
  const fs = platform.fileSystem;
  for (const entry of entries) {
    const directory = fs.dirname(entry.path);
    const key = fs.normalizePathForIdentity(directory);
    const values = byDirectory.get(key) ?? [];
    values.push(entry);
    byDirectory.set(key, values);

    if (fs.basename(directory).toLowerCase() === "extrafanart" && imageExtensions.has(entry.extension)) {
      const parentKey = fs.normalizePathForIdentity(fs.dirname(directory));
      const extras = extrafanartByParentDirectory.get(parentKey) ?? [];
      extras.push(entry);
      extrafanartByParentDirectory.set(parentKey, extras);
    }
  }
  return { byDirectory, extrafanartByParentDirectory };
}

function observeSidecars(
  video: PlatformFileEntry,
  index: SidecarEntryIndex,
  platform: PlatformServices,
): MediaSidecarObservation {
  const fs = platform.fileSystem;
  const directory = fs.dirname(video.path);
  const directoryKey = fs.normalizePathForIdentity(directory);
  const direct = index.byDirectory.get(directoryKey) ?? [];
  const videoStem = normalizeStem(fs.basename(video.path, fs.extname(video.path)));
  const directNfos = direct.filter((entry) => entry.extension === ".nfo");
  const directVideoCount = direct.filter((entry) => videoExtensions.has(entry.extension)).length;
  const singleVideoDirectory = directVideoCount === 1;

  const nfoPaths = directNfos
    .filter((entry) => {
      const name = entry.name.toLowerCase();
      const stem = normalizeStem(fs.basename(entry.path, entry.extension));
      return stem === videoStem || (singleVideoDirectory && (name === "movie.nfo" || directNfos.length === 1));
    })
    .map((entry) => entry.path);

  const directImages = direct.filter((entry) => imageExtensions.has(entry.extension));
  const posterPaths = directImages
    .filter((entry) => isPosterCandidate(entry, videoStem, singleVideoDirectory, platform))
    .map((entry) => entry.path);
  const fanartPaths = directImages
    .filter((entry) => isFanartCandidate(entry, videoStem, singleVideoDirectory, platform))
    .map((entry) => entry.path);

  for (const entry of index.extrafanartByParentDirectory.get(directoryKey) ?? []) {
    fanartPaths.push(entry.path);
  }

  return {
    nfoPaths: uniqueSorted(nfoPaths),
    posterPaths: uniqueSorted(posterPaths),
    fanartPaths: uniqueSorted(fanartPaths),
  };
}

function isPosterCandidate(entry: PlatformFileEntry, videoStem: string, singleVideoDirectory: boolean, platform: PlatformServices): boolean {
  const stem = normalizeStem(platform.fileSystem.basename(entry.path, entry.extension));
  const raw = platform.fileSystem.basename(entry.path, entry.extension).toLowerCase();
  const generic = raw === "poster" || raw === "cover" || raw === "ps";
  const marked = /(?:^|[-_.])(poster|cover|ps)(?:$|[-_.])/.test(raw);
  return (singleVideoDirectory && (generic || marked))
    || (stem.startsWith(videoStem) && /(poster|cover|ps)$/.test(stem));
}

function isFanartCandidate(entry: PlatformFileEntry, videoStem: string, singleVideoDirectory: boolean, platform: PlatformServices): boolean {
  const stem = normalizeStem(platform.fileSystem.basename(entry.path, entry.extension));
  const raw = platform.fileSystem.basename(entry.path, entry.extension).toLowerCase();
  const generic = raw === "fanart" || raw === "background" || raw === "backdrop" || raw === "pl";
  const marked = /(?:^|[-_.])(fanart|background|backdrop|pl)(?:$|[-_.])/.test(raw);
  return (singleVideoDirectory && (generic || marked))
    || (stem.startsWith(videoStem) && /(fanart|background|backdrop|pl)$/.test(stem));
}

function resolveBinding(previous: MediaFile | undefined, codeMatch: Work | undefined): {
  workId?: string;
  matchMethod?: "code" | "manual";
} {
  if (previous?.matchMethod === "manual") {
    return previous.workId ? { workId: previous.workId, matchMethod: "manual" } : {};
  }
  return codeMatch ? { workId: codeMatch.id, matchMethod: "code" } : {};
}

function matchWorkByCode(works: Work[], filePath: string, platform: PlatformServices): Work | undefined {
  const extension = platform.fileSystem.extname(filePath);
  const file = compactCode(platform.fileSystem.basename(filePath, extension));
  return [...works]
    .filter((work) => compactCode(work.code).length >= 4)
    .sort((a, b) => compactCode(b.code).length - compactCode(a.code).length)
    .find((work) => file.includes(compactCode(work.code)));
}

function compactCode(value: string): string {
  return value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeStem(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[\s._-]+/g, "");
}

function readPreviousProbe(previous: MediaFile): Pick<MediaFile,
  "durationSeconds" | "width" | "height" | "videoCodec" | "audioCodec" | "container"> {
  return {
    ...(previous.durationSeconds !== undefined ? { durationSeconds: previous.durationSeconds } : {}),
    ...(previous.width !== undefined ? { width: previous.width } : {}),
    ...(previous.height !== undefined ? { height: previous.height } : {}),
    ...(previous.videoCodec ? { videoCodec: previous.videoCodec } : {}),
    ...(previous.audioCodec ? { audioCodec: previous.audioCodec } : {}),
    ...(previous.container ? { container: previous.container } : {}),
  };
}

function hasProbeValues(media?: MediaFile): boolean {
  return Boolean(media && (
    media.durationSeconds !== undefined
    || media.width !== undefined
    || media.height !== undefined
    || media.videoCodec
    || media.audioCodec
    || media.container
  ));
}

function sameSidecars(a: MediaSidecarObservation | undefined, b: MediaSidecarObservation): boolean {
  const left = a ?? { nfoPaths: [], posterPaths: [], fanartPaths: [] };
  return sameArray(left.nfoPaths, b.nfoPaths)
    && sameArray(left.posterPaths, b.posterPaths)
    && sameArray(left.fanartPaths, b.fanartPaths);
}

function sameArray(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function hasSidecars(value: MediaSidecarObservation): boolean {
  return value.nfoPaths.length > 0 || value.posterPaths.length > 0 || value.fanartPaths.length > 0;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "en"));
}

function emit(hooks: MediaScanHooks, progress: MediaScanProgress): void {
  hooks.onProgress?.(progress);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error("媒体扫描已取消。");
  error.name = "AbortError";
  throw error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
