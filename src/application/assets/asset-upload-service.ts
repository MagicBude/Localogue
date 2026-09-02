import { createHash } from "node:crypto";
import { access, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Asset, AssetSubjectType, AssetType } from "@/domain/entities/asset";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import { getConfiguredPrivateLibraryPath } from "@/infrastructure/repositories/library-path";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const supportedMimeTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/avif", ".avif"],
]);

export interface UploadAssetInput {
  repository: LibraryRepository;
  subjectType: AssetSubjectType;
  subjectId: string;
  type: AssetType;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

/**
 * 将上传图片保存为 Private Asset。
 *
 * 关键点：
 * - 文件名不参与真实磁盘文件名，避免路径注入；
 * - 二进制按 SHA-256 内容寻址，同一图片重复上传只保存一份；
 * - Asset JSON 与二进制分离，后续换数据库不会影响图片存储。
 */
export async function uploadPrivateAsset(input: UploadAssetInput): Promise<Asset> {
  const privateRoot = getConfiguredPrivateLibraryPath();
  if (!privateRoot) throw new Error("请先在设置中配置可写的 Private Library。");
  if (!supportedMimeTypes.has(input.mimeType)) {
    throw new Error("当前只支持 JPEG、PNG、WebP、GIF 和 AVIF 图片；SVG 因安全原因暂不允许上传。");
  }
  if (input.bytes.byteLength === 0) throw new Error("上传文件为空。");
  if (input.bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("图片不能超过 25 MB。");

  await ensureSubjectExists(input.repository, input.subjectType, input.subjectId);
  assertImageTypeMatchesSubject(input.subjectType, input.type);

  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const extension = supportedMimeTypes.get(input.mimeType) as string;
  const relativePath = path.posix.join("asset-files", `${sha256}${extension}`);
  const absolutePath = path.join(privateRoot, "asset-files", `${sha256}${extension}`);
  await mkdir(path.dirname(absolutePath), { recursive: true });

  const temporaryPath = `${absolutePath}.tmp`;
  await writeFile(temporaryPath, input.bytes);
  try {
    await rename(temporaryPath, absolutePath);
  } catch (error) {
    // Windows 上目标已存在时 rename 可能报 EEXIST/EPERM。只有确认目标文件确实存在，
    // 才能把它解释为“同一内容已经落盘”；否则必须继续抛错。
    try {
      await access(absolutePath);
      await unlink(temporaryPath).catch(() => undefined);
    } catch {
      throw error;
    }
  }

  const dimensions = readImageDimensions(input.bytes, input.mimeType);
  // 二进制使用内容 Hash 去重，但 Asset Entity ID 还必须包含“归属 + 类型”。
  // 否则同一张图片被两个不同人物使用时，第二次上传会覆盖第一条 Asset JSON 的 subject。
  const assetIdentity = createHash("sha256")
    .update(`${input.subjectType}\0${input.subjectId}\0${input.type}\0${sha256}`)
    .digest("hex");
  const asset: Asset = {
    schemaVersion: 1,
    id: `asset_${assetIdentity.slice(0, 24)}`,
    type: input.type,
    storagePath: relativePath,
    mimeType: input.mimeType,
    fileSize: input.bytes.byteLength,
    sha256,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    createdAt: new Date().toISOString(),
    ...dimensions,
  };
  await input.repository.saveAsset(asset);
  return asset;
}

function assertImageTypeMatchesSubject(subjectType: AssetSubjectType, type: AssetType) {
  const allowed = subjectType === "person"
    ? new Set<AssetType>(["portrait", "gallery"])
    : new Set<AssetType>(["poster", "cover", "fanart", "screenshot"]);
  if (!allowed.has(type)) throw new Error(`${subjectType} 不支持 Asset type ${type}。`);
}

async function ensureSubjectExists(
  repository: LibraryRepository,
  subjectType: AssetSubjectType,
  subjectId: string,
) {
  const entity = subjectType === "person"
    ? await repository.findPersonById(subjectId)
    : await repository.findWorkById(subjectId);
  if (!entity) throw new Error(`找不到 ${subjectType} ${subjectId}。`);
}

function readImageDimensions(bytes: Uint8Array, mimeType: string): { width?: number; height?: number } {
  if (mimeType === "image/png" && bytes.length >= 24) {
    return { width: readUInt32BE(bytes, 16), height: readUInt32BE(bytes, 20) };
  }
  if (mimeType === "image/gif" && bytes.length >= 10) {
    return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
  }
  if (mimeType === "image/jpeg") return readJpegDimensions(bytes);
  if (mimeType === "image/webp") return readWebpDimensions(bytes);
  return {};
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function readJpegDimensions(bytes: Uint8Array): { width?: number; height?: number } {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + length + 2 > bytes.length) break;
    const isSof = [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker);
    if (isSof) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }
    offset += length + 2;
  }
  return {};
}

function readWebpDimensions(bytes: Uint8Array): { width?: number; height?: number } {
  if (bytes.length < 30) return {};
  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  if (chunk === "VP8X") {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return { width, height };
  }
  return {};
}
