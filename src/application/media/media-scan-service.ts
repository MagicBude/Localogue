import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { MediaFile } from "@/domain/entities/media-file";
import type { Work } from "@/domain/entities/work";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import { readInstanceSettings } from "@/infrastructure/settings/instance-settings-store";

const execFileAsync = promisify(execFile);
const videoExtensions = new Set([
  ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".m4v", ".ts", ".mts", ".m2ts", ".webm", ".flv",
]);
const MAX_DISCOVERED_FILES = 5000;

export interface MediaScanOptions {
  computeSha256?: boolean;
  probeMedia?: boolean;
  pruneMissing?: boolean;
}

export interface MediaScanResult {
  roots: string[];
  discovered: number;
  saved: number;
  matched: number;
  unmatched: number;
  removed: number;
  probed: number;
  hashed: number;
  warnings: string[];
}

/**
 * 扫描设置页配置的本地媒体目录。
 *
 * V1-10 仍然是同步请求模型，适合个人资料库和教学；未来目录非常大时，
 * 这项工作应该迁移到任务队列/后台 Worker，而不是无限延长一个 HTTP 请求。
 */
export async function scanConfiguredMedia(
  repository: LibraryRepository,
  options: MediaScanOptions = {},
): Promise<MediaScanResult> {
  const settings = readInstanceSettings();
  const configuredRoots = (settings.mediaScanPaths ?? []).map((item) => path.resolve(process.cwd(), item));
  if (!configuredRoots.length) throw new Error("请先在设置页配置至少一个媒体扫描目录。");

  const roots: string[] = [];
  const warnings: string[] = [];
  const discoveredPaths: string[] = [];
  for (const root of configuredRoots) {
    try {
      const info = await stat(root);
      if (!info.isDirectory()) throw new Error("不是目录");
      roots.push(root);
      await discoverVideos(root, discoveredPaths);
    } catch (error) {
      warnings.push(`无法扫描 ${root}: ${message(error)}`);
    }
  }
  if (!roots.length) throw new Error("没有可读取的媒体扫描目录。");

  const workResult = await repository.listWorks({ page: 1, pageSize: 100000 });
  const works = workResult.items;
  const existing = await repository.listMediaFiles();
  const scannedIds = new Set<string>();
  let saved = 0;
  let matched = 0;
  let probed = 0;
  let hashed = 0;
  let ffprobeUnavailable = false;

  for (const filePath of discoveredPaths.slice(0, MAX_DISCOVERED_FILES)) {
    const fileStat = await stat(filePath);
    const id = mediaFileIdFromPath(filePath);
    scannedIds.add(id);
    const previous = existing.find((item) => item.id === id);
    const work = matchWorkByCode(works, filePath);
    const now = new Date().toISOString();
    let probe: ProbeResult = {};

    if (options.probeMedia !== false && !ffprobeUnavailable) {
      try {
        probe = await probeFile(settings.ffprobePath?.trim() || "ffprobe", filePath);
        probed += 1;
      } catch (error) {
        if (isExecutableMissing(error)) ffprobeUnavailable = true;
        warnings.push(`ffprobe ${path.basename(filePath)}: ${message(error)}`);
      }
    }

    let sha256 = previous?.sha256;
    if (options.computeSha256) {
      sha256 = await hashFile(filePath);
      hashed += 1;
    }

    const media: MediaFile = {
      schemaVersion: 1,
      id,
      ...(work ? { workId: work.id, matchMethod: "code" as const } : {}),
      path: filePath,
      fileName: path.basename(filePath),
      extension: path.extname(filePath).toLowerCase(),
      fileSize: fileStat.size,
      fileModifiedAt: fileStat.mtime.toISOString(),
      scanRoot: findOwningRoot(roots, filePath),
      ...(probe.durationSeconds !== undefined ? { durationSeconds: probe.durationSeconds } : {}),
      ...(probe.width !== undefined ? { width: probe.width } : {}),
      ...(probe.height !== undefined ? { height: probe.height } : {}),
      ...(probe.videoCodec ? { videoCodec: probe.videoCodec } : {}),
      ...(probe.audioCodec ? { audioCodec: probe.audioCodec } : {}),
      ...(probe.container ? { container: probe.container } : {}),
      ...(sha256 ? { sha256 } : {}),
      analyzedAt: now,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    await repository.saveMediaFile(media);
    saved += 1;
    if (work) matched += 1;
  }

  let removed = 0;
  if (options.pruneMissing !== false) {
    for (const item of existing) {
      if (!item.scanRoot || !roots.some((root) => samePath(root, item.scanRoot as string))) continue;
      if (scannedIds.has(item.id)) continue;
      try {
        await access(item.path);
      } catch {
        await repository.deleteMediaFile(item.id);
        removed += 1;
      }
    }
  }

  if (discoveredPaths.length > MAX_DISCOVERED_FILES) {
    warnings.push(`本次发现 ${discoveredPaths.length} 个视频，只处理前 ${MAX_DISCOVERED_FILES} 个；V1 同步扫描暂设安全上限。`);
  }

  return {
    roots,
    discovered: Math.min(discoveredPaths.length, MAX_DISCOVERED_FILES),
    saved,
    matched,
    unmatched: saved - matched,
    removed,
    probed,
    hashed,
    warnings,
  };
}

async function discoverVideos(directory: string, output: string[]): Promise<void> {
  if (output.length >= MAX_DISCOVERED_FILES + 1) return;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await discoverVideos(fullPath, output);
    else if (entry.isFile() && videoExtensions.has(path.extname(entry.name).toLowerCase())) output.push(fullPath);
    if (output.length >= MAX_DISCOVERED_FILES + 1) return;
  }
}

function matchWorkByCode(works: Work[], filePath: string): Work | undefined {
  const file = compactCode(path.basename(filePath, path.extname(filePath)));
  return [...works]
    .filter((work) => compactCode(work.code).length >= 4)
    .sort((a, b) => compactCode(b.code).length - compactCode(a.code).length)
    .find((work) => file.includes(compactCode(work.code)));
}

function compactCode(value: string): string {
  return value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function mediaFileIdFromPath(filePath: string): string {
  const normalized = process.platform === "win32" ? filePath.toLowerCase() : filePath;
  return `media_${createHash("sha256").update(normalized).digest("hex").slice(0, 24)}`;
}

interface ProbeResult {
  durationSeconds?: number;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  container?: string;
}

async function probeFile(ffprobePath: string, filePath: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync(ffprobePath, [
    "-v", "error",
    "-show_entries", "format=format_name,duration:stream=codec_type,codec_name,width,height",
    "-of", "json",
    filePath,
  ], { timeout: 20_000, windowsHide: true, maxBuffer: 1024 * 1024, encoding: "utf8" });
  const parsed = JSON.parse(stdout) as {
    format?: { format_name?: string; duration?: string };
    streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number }>;
  };
  const video = parsed.streams?.find((item) => item.codec_type === "video");
  const audio = parsed.streams?.find((item) => item.codec_type === "audio");
  const duration = parsed.format?.duration ? Number(parsed.format.duration) : undefined;
  return {
    ...(Number.isFinite(duration) ? { durationSeconds: duration } : {}),
    ...(video?.width ? { width: video.width } : {}),
    ...(video?.height ? { height: video.height } : {}),
    ...(video?.codec_name ? { videoCodec: video.codec_name } : {}),
    ...(audio?.codec_name ? { audioCodec: audio.codec_name } : {}),
    ...(parsed.format?.format_name ? { container: parsed.format.format_name } : {}),
  };
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => {
      hash.update(chunk);
    });
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

function findOwningRoot(roots: string[], filePath: string): string | undefined {
  return [...roots].sort((a, b) => b.length - a.length).find((root) => isInside(root, filePath));
}
function isInside(root: string, filePath: string): boolean {
  const relative = path.relative(root, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
function samePath(a: string, b: string): boolean {
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}
function isExecutableMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
