import type {
  PortablePackEnvelope,
  PortablePackFile,
  PortablePackImportResult,
  PortablePackManifest,
  PortablePackPreview,
} from "@/domain/entities/portable-pack";

import type { DesktopPortableFile } from "./contracts";
import { desktopBridge } from "./tauri-bridge";

const MAX_PACK_BYTES = 256 * 1024 * 1024;
const PERSONAL_ALLOWED = new Set([
  "works", "people", "organizations", "series", "genres", "tags", "assets", "asset-files",
  "presentation-preferences", "evidence", "evidence-lifecycle", "review-commits", "snapshots",
  "restore-receipts", "provenance", "person-edits", "media-binding-receipts",
]);

export interface DesktopPortablePreview extends PortablePackPreview {
  path: string;
  envelope: PortablePackEnvelope;
}

export async function exportDesktopPersonalPack(): Promise<string | null> {
  const sourceFiles = await desktopBridge.collectPrivatePortableFiles();
  const manifest: PortablePackManifest = {
    schemaVersion: 1,
    kind: "personal-backup",
    id: `personal_${crypto.randomUUID()}`,
    name: "Localogue Personal Backup",
    version: timestampVersion(),
    createdAt: new Date().toISOString(),
    description: "Private Library metadata/assets backup. Media binaries and instance settings are intentionally excluded.",
  };
  const files = await Promise.all(sourceFiles.map(toPortableFile));
  const bytes = await encodePortableEnvelope({ schemaVersion: 1, format: "localogue-portable-pack", manifest, files });
  if (bytes.byteLength > MAX_PACK_BYTES) throw new Error("Portable Pack 超过 256 MB 安全上限。请减少本地 Asset 后重试。");
  return desktopBridge.savePortablePackFile(`localogue-personal-${manifest.version}.localogue-pack`, bytes);
}

export async function exportDesktopSharedPack(input: { configuredPath: string; id: string; name: string; version: string }): Promise<string | null> {
  const sourceFiles = await desktopBridge.collectSharedPortableFiles(input.configuredPath);
  const manifest: PortablePackManifest = {
    schemaVersion: 1,
    kind: "shared-library",
    id: `portable_${crypto.randomUUID()}`,
    name: `${input.name} Portable Archive`,
    version: input.version,
    createdAt: new Date().toISOString(),
    sourcePackId: input.id,
    sourcePackVersion: input.version,
  };
  const files = await Promise.all(sourceFiles.map(toPortableFile));
  const bytes = await encodePortableEnvelope({ schemaVersion: 1, format: "localogue-portable-pack", manifest, files });
  if (bytes.byteLength > MAX_PACK_BYTES) throw new Error("Portable Pack 超过 256 MB 安全上限。 ");
  return desktopBridge.savePortablePackFile(`${safeName(input.id)}-${safeName(input.version)}.localogue-pack`, bytes);
}

export async function pickAndPreviewPortablePack(): Promise<DesktopPortablePreview | null> {
  const path = await desktopBridge.pickPortablePackFile();
  if (!path) return null;
  const raw = new Uint8Array(await desktopBridge.readPortablePackFile(path));
  if (raw.byteLength > MAX_PACK_BYTES) throw new Error("Portable Pack 超过 256 MB 安全上限。 ");
  const envelope = await decodePortableEnvelope(raw);
  const errors: string[] = [];
  const warnings: string[] = [];
  const conflicts: string[] = [];
  if (envelope.schemaVersion !== 1 || envelope.format !== "localogue-portable-pack") errors.push("不是受支持的 Localogue Portable Pack。 ");
  if (!envelope.manifest?.id || !envelope.manifest.name || !envelope.manifest.version) errors.push("Portable Pack manifest 缺少 id / name / version。 ");
  const seen = new Set<string>();
  for (const file of envelope.files ?? []) {
    try {
      const normalized = normalizePackPath(file.path);
      if (seen.has(normalized)) errors.push(`重复路径：${normalized}`);
      seen.add(normalized);
      const bytes = decodePortableFile(file);
      if (bytes.byteLength !== file.size) errors.push(`${normalized}: 文件大小不一致。`);
      if (await sha256Bytes(bytes) !== file.sha256) errors.push(`${normalized}: SHA-256 校验失败。`);
      if (envelope.manifest.kind === "personal-backup" && !PERSONAL_ALLOWED.has(normalized.split("/")[0] ?? "")) errors.push(`${normalized}: 不属于 Personal Pack 白名单。`);
      if (envelope.manifest.kind === "shared-library" && normalized !== "localogue-pack.json" && !normalized.startsWith("library/") && !normalized.startsWith("sources/")) errors.push(`${normalized}: 不属于 Shared Pack 白名单。`);
    } catch (error) { errors.push(message(error)); }
  }
  if (envelope.manifest.kind === "shared-library" && !envelope.files.some((file) => file.path === "localogue-pack.json")) errors.push("Shared Pack 缺少 localogue-pack.json。 ");
  if (envelope.manifest.kind === "personal-backup") warnings.push("Personal Pack 导入默认不覆盖已经存在的 Private 文件。 ");
  return {
    path,
    envelope,
    manifest: envelope.manifest,
    fileCount: envelope.files.length,
    totalBytes: envelope.files.reduce((sum, file) => sum + file.size, 0),
    errors,
    warnings,
    conflicts,
    importable: errors.length === 0,
  };
}

export async function importDesktopPortablePreview(preview: DesktopPortablePreview): Promise<PortablePackImportResult> {
  if (!preview.importable) throw new Error(preview.errors.join("；"));
  const files: DesktopPortableFile[] = preview.envelope.files.map((file) => ({ path: normalizePackPath(file.path), bytes: decodePortableFile(file) }));
  if (preview.manifest.kind === "personal-backup") {
    const result = await desktopBridge.importPrivatePortableFiles(files);
    return { kind: "personal-backup", imported: result.imported, skipped: result.skipped, warnings: result.skipped ? [`跳过 ${result.skipped} 个已存在文件。`] : [] };
  }
  const installedPath = await desktopBridge.installSharedPortableFiles(
    preview.manifest.sourcePackId ?? preview.manifest.id,
    preview.manifest.sourcePackVersion ?? preview.manifest.version,
    files,
  );
  return { kind: "shared-library", imported: files.length, skipped: 0, installedPath, sharedPackPath: installedPath, warnings: [] };
}

async function toPortableFile(file: DesktopPortableFile): Promise<PortablePackFile> {
  const path = normalizePackPath(file.path);
  const bytes = toBytes(file.bytes);
  const binary = path.startsWith("asset-files/");
  return {
    path,
    encoding: binary ? "base64" : "utf8",
    content: binary ? bytesToBase64(bytes) : new TextDecoder().decode(bytes),
    sha256: await sha256Bytes(bytes),
    size: bytes.byteLength,
  };
}

function decodePortableFile(file: PortablePackFile): Uint8Array {
  return file.encoding === "base64" ? base64ToBytes(file.content) : new TextEncoder().encode(file.content);
}

async function encodePortableEnvelope(envelope: PortablePackEnvelope): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(JSON.stringify(envelope));
  if (typeof CompressionStream === "undefined") throw new Error("当前 WebView 不支持 gzip CompressionStream。请升级 WebView2 Runtime。 ");
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decodePortableEnvelope(bytes: Uint8Array): Promise<PortablePackEnvelope> {
  if (typeof DecompressionStream === "undefined") throw new Error("当前 WebView 不支持 gzip DecompressionStream。请升级 WebView2 Runtime。 ");
  const stream = new Blob([copyToArrayBuffer(bytes)]).stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  const parsed = JSON.parse(text) as PortablePackEnvelope;
  if (!parsed || !Array.isArray(parsed.files)) throw new Error("Portable Pack 缺少 files。 ");
  return parsed;
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", copyToArrayBuffer(bytes));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function normalizePackPath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) throw new Error(`Pack 路径不合法：${value}`);
  const parts = normalized.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) throw new Error(`Pack 路径包含目录穿越：${value}`);
  return parts.join("/");
}
function toBytes(value: DesktopPortableFile["bytes"]): Uint8Array { return value instanceof Uint8Array ? value : new Uint8Array(value); }
function bytesToBase64(bytes: Uint8Array): string { let binary = ""; const chunk = 0x8000; for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk)); return btoa(binary); }
function base64ToBytes(value: string): Uint8Array { const binary = atob(value); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i); return bytes; }
function timestampVersion(): string { return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
function safeName(value: string): string { return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-"); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
