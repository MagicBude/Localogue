import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

import type { PortablePackEnvelope, PortablePackFile } from "@/domain/entities/portable-pack";

const MAX_DECOMPRESSED_BYTES = 512 * 1024 * 1024;

export function encodePortablePack(envelope: PortablePackEnvelope): Uint8Array {
  const serialized = Buffer.from(JSON.stringify(envelope), "utf8");
  return gzipSync(serialized, { level: 6 });
}

export function decodePortablePack(bytes: Uint8Array): PortablePackEnvelope {
  const decompressed = gunzipSync(bytes, { maxOutputLength: MAX_DECOMPRESSED_BYTES });
  const parsed = JSON.parse(decompressed.toString("utf8")) as PortablePackEnvelope;
  if (parsed.schemaVersion !== 1 || parsed.format !== "localogue-portable-pack") {
    throw new Error("不是受支持的 Localogue Portable Pack。当前只支持 schemaVersion 1。");
  }
  if (!parsed.manifest || !Array.isArray(parsed.files)) throw new Error("Portable Pack 缺少 manifest 或 files。");
  return parsed;
}

export function makePortableFile(relativePath: string, bytes: Uint8Array, binary = false): PortablePackFile {
  return {
    path: normalizePackPath(relativePath),
    encoding: binary ? "base64" : "utf8",
    content: binary ? Buffer.from(bytes).toString("base64") : Buffer.from(bytes).toString("utf8"),
    sha256: sha256(bytes),
    size: bytes.byteLength,
  };
}

export function decodePortableFile(file: PortablePackFile): Uint8Array {
  const bytes = file.encoding === "base64"
    ? Buffer.from(file.content, "base64")
    : Buffer.from(file.content, "utf8");
  if (bytes.byteLength !== file.size) throw new Error(`${file.path}: 文件大小与 Pack Manifest 不一致。`);
  if (sha256(bytes) !== file.sha256) throw new Error(`${file.path}: SHA-256 校验失败。`);
  return bytes;
}

export function normalizePackPath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) {
    throw new Error(`Pack 文件路径不合法：${value}`);
  }
  const parts = normalized.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Pack 文件路径包含目录穿越：${value}`);
  }
  return parts.join("/");
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
