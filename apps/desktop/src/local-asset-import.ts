import { inferCatalogFilenameMetadata, normalizeNfoCode } from "@/application/importers/nfo-filename-metadata";
import type { Asset, AssetType } from "@/domain/entities/asset";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import type { DesktopFileEntry } from "./contracts";

import type { NfoImportPreview } from "./nfo-library-import";
import { desktopBridge } from "./tauri-bridge";
import { buildDesktopWorkCodeIndex } from "./desktop-work-code-index";

const MAX_ASSET_FILES = 100_000;
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

export type LocalAssetImportStatus =
  | "ready"
  | "pending_work"
  | "missing_code"
  | "work_not_found"
  | "unknown_asset_type";

export interface LocalAssetImportItem {
  path: string;
  fileName: string;
  size: number;
  modifiedAt: string;
  status: LocalAssetImportStatus;
  type?: AssetType;
  code?: string;
  matchedWorkId?: string;
  matchedBy?: "filename-code" | "nfo-stem";
}

export interface LocalAssetImportPreview {
  roots: string[];
  discovered: number;
  linkable: number;
  pendingWork: number;
  skipped: number;
  items: LocalAssetImportItem[];
}

export interface LocalAssetImportResult {
  imported: number;
  createdAssets: number;
  reusedAssets: number;
  updatedWorks: number;
  skipped: number;
  warnings: string[];
}

/**
 * 扫描本地海报 / 封面 / fanart / thumb。
 *
 * 关联优先级：
 * 1. 图片文件名自身的番号；
 * 2. 与 NFO 去掉角色后缀后的同 stem；
 * 3. 没有可靠 Work 时只预览，不写 Asset。
 *
 * 图片可以和 NFO / 视频位于不同子目录，只要都位于某个 Unified Library Root
 * 或显式兼容扫描路径中即可。
 */
export async function previewLocalAssetImport(
  roots: readonly string[],
  repository: LibraryRepository,
  nfoPreview?: NfoImportPreview | null,
  discoveredEntries?: readonly DesktopFileEntry[],
): Promise<LocalAssetImportPreview> {
  const rootList = unique(roots.map((item) => item.trim()).filter(Boolean));
  const worksByCode = await buildDesktopWorkCodeIndex(repository, compactCode);
  const discovered = new Map<string, Awaited<ReturnType<typeof desktopBridge.walkFiles>>[number]>();
  if (discoveredEntries) {
    for (const entry of discoveredEntries) discovered.set(normalizePath(entry.path), entry);
  } else {
    // 独立高级预览保留原入口；统一同步传共享发现结果，解析器不关心目录怎样遍历。
    for (const root of rootList) {
      const entries = await desktopBridge.walkFiles({ root, extensions: IMAGE_EXTENSIONS, includeHidden: false, maxFiles: MAX_ASSET_FILES });
      for (const entry of entries) discovered.set(normalizePath(entry.path), entry);
    }
  }

  const nfoStemCodes = new Map<string, string>();
  const pendingNfoCodes = new Set<string>();
  for (const item of nfoPreview?.items ?? []) {
    if (!item.code) continue;
    nfoStemCodes.set(metadataStem(item.fileName), item.code);
    // pending_work 只接受 NFO Preview 已明确识别、会在本轮导入创建的番号。
    // 预先建 Set 后，每张图片无需再遍历全部 NFO 条目。
    if (["new_work", "duplicate_code"].includes(item.status)) pendingNfoCodes.add(compactCode(item.code));
  }

  const items: LocalAssetImportItem[] = [];
  for (const entry of [...discovered.values()].sort((a, b) => a.path.localeCompare(b.path, "en"))) {
    const type = inferAssetType(entry.name);
    if (!type) {
      items.push({ ...entry, fileName: entry.name, status: "unknown_asset_type" });
      continue;
    }

    const filenameMetadata = inferCatalogFilenameMetadata(entry.name);
    const directCode = filenameMetadata.code ? normalizeNfoCode(filenameMetadata.code) : undefined;
    const stemCode = nfoStemCodes.get(metadataStem(entry.name));
    const code = directCode ?? stemCode;
    if (!code) {
      items.push({ ...entry, fileName: entry.name, status: "missing_code", type });
      continue;
    }

    const matched = worksByCode.get(compactCode(code)) ?? null;
    const pendingWork = !matched && pendingNfoCodes.has(compactCode(code));
    items.push({
      ...entry,
      fileName: entry.name,
      status: matched ? "ready" : pendingWork ? "pending_work" : "work_not_found",
      type,
      code,
      ...(matched ? { matchedWorkId: matched.id } : {}),
      matchedBy: directCode ? "filename-code" : "nfo-stem",
    });
  }

  return {
    roots: rootList,
    discovered: items.length,
    linkable: items.filter((item) => item.status === "ready" || item.status === "pending_work").length,
    pendingWork: items.filter((item) => item.status === "pending_work").length,
    skipped: items.filter((item) => !["ready", "pending_work"].includes(item.status)).length,
    items,
  };
}

/**
 * 将本地图片复制到 Private Library/asset-files，并创建 Asset JSON 后挂到 Work.assetIds。
 * 原始图片不移动、不删除；Private Asset 使用 SHA-256 内容寻址，因此同一图片重复导入不会重复占空间。
 */
export async function importLocalAssetPreview(
  preview: LocalAssetImportPreview,
  repository: LibraryRepository,
  hashText: (value: string) => string,
): Promise<LocalAssetImportResult> {
  const result: LocalAssetImportResult = {
    imported: 0,
    createdAssets: 0,
    reusedAssets: 0,
    updatedWorks: 0,
    skipped: 0,
    warnings: [],
  };

  const groups = new Map<string, LocalAssetImportItem[]>();
  for (const item of preview.items) {
    if (!["ready", "pending_work"].includes(item.status) || !item.code || !item.type) {
      result.skipped += 1;
      continue;
    }
    const key = compactCode(item.code);
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }

  // 同一 Work 的 poster / fanart / thumb 一次性处理，最后只写一次 Work.assetIds。
  // 真实资料库通常每个作品有 3~4 张图片；按图片逐张 saveWork 会反复清空
  // Repository cache 并重读整套 Works，在数百张图片时会放大 I/O。
  for (const items of groups.values()) {
    const code = items[0]?.code;
    if (!code) continue;
    const work = await repository.findWorkByCode(code);
    if (!work) {
      result.skipped += items.length;
      result.warnings.push(`${code}: 找不到 Work；如果它来自 NFO，请先确认该 NFO 已成功导入（${items.length} 张图片跳过）。`);
      continue;
    }

    const assetIds = new Set(work.assetIds);
    let workChanged = false;

    for (const item of items) {
      try {
        const stored = await desktopBridge.importPrivateAssetFile(item.path);
        const identity = hashText(`work\0${work.id}\0${item.type}\0${stored.sha256}`);
        const id = `asset_${identity.slice(0, 24)}`;
        const existing = await repository.findAssetById(id);
        if (!existing) {
          const asset: Asset = {
            schemaVersion: 1,
            id,
            type: item.type!,
            storagePath: stored.storagePath,
            mimeType: stored.mimeType,
            fileSize: stored.fileSize,
            sha256: stored.sha256,
            // 保留原图位置只为方便用户回到资料目录；真正展示仍读取稳定的管理副本。
            localSourcePath: item.path,
            subjectType: "work",
            subjectId: work.id,
            createdAt: new Date().toISOString(),
          };
          await repository.saveAsset(asset);
          result.createdAssets += 1;
        } else {
          // 内容 Hash 相同会复用 Asset；仍刷新本机来源路径，这样旧资料库再次同步后
          // 也能获得“定位原图”，无需用户先删除再导入。
          if (existing.localSourcePath !== item.path) {
            await repository.saveAsset({ ...existing, localSourcePath: item.path });
          }
          result.reusedAssets += 1;
        }

        if (!assetIds.has(id)) {
          assetIds.add(id);
          workChanged = true;
        }
        result.imported += 1;
      } catch (error) {
        result.skipped += 1;
        result.warnings.push(`${item.fileName}: ${message(error)}`);
      }
    }

    if (workChanged) {
      try {
        await repository.saveWork({
          ...work,
          assetIds: [...assetIds],
          updatedAt: new Date().toISOString(),
        });
        result.updatedWorks += 1;
      } catch (error) {
        result.warnings.push(`${work.code}: Asset 已复制/登记，但更新 Work.assetIds 失败：${message(error)}`);
      }
    }
  }

  return result;
}

export function inferAssetType(fileName: string): AssetType | undefined {
  const stem = stripExtension(fileName).normalize("NFKC").toLowerCase();
  if (/(?:^|[-_.\s])(fanart|background|backdrop)(?:[-_.\s]?\d+)?$/u.test(stem)) return "fanart";
  if (/(?:^|[-_.\s])poster(?:[-_.\s]?\d+)?$/u.test(stem)) return "poster";
  if (/(?:^|[-_.\s])cover(?:[-_.\s]?\d+)?$/u.test(stem)) return "cover";
  if (/(?:^|[-_.\s])(thumb|thumbnail|screenshot)(?:[-_.\s]?\d+)?$/u.test(stem)) return "screenshot";
  return undefined;
}

function metadataStem(fileName: string): string {
  return stripExtension(fileName)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(?:[-_.\s])(fanart|background|backdrop|poster|cover|thumb|thumbnail|screenshot)(?:[-_.\s]?\d+)?$/u, "")
    .replace(/(?:[-_.\s])(part|cd|disc|disk)[-_.\s]?\d+$/u, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function stripExtension(value: string): string {
  return value.replace(/\.(?:jpe?g|png|webp|gif|avif|nfo)$/iu, "");
}
function normalizePath(value: string): string { return value.replaceAll("\\", "/"); }
function compactCode(value: string): string { return value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function unique<T>(values: T[]): T[] { return [...new Set(values)]; }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
