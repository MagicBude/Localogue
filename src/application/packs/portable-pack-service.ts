import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  PortablePackEnvelope,
  PortablePackFile,
  PortablePackImportResult,
  PortablePackManifest,
  PortablePackPreview,
} from "@/domain/entities/portable-pack";
import { getConfiguredPrivateLibraryPath } from "@/infrastructure/repositories/library-path";
import { readInstanceSettings, saveInstanceSettings } from "@/infrastructure/settings/instance-settings-store";
import { resolveSharedPack } from "@/infrastructure/shared-packs/shared-pack-resolver";
import {
  decodePortableFile,
  decodePortablePack,
  encodePortablePack,
  makePortableFile,
  normalizePackPath,
} from "@/infrastructure/packs/portable-pack-codec";
import { validateCommunityPackRoot } from "@/infrastructure/packs/community-pack-validator";

const PERSONAL_DIRECTORIES = [
  "works", "people", "organizations", "series", "genres", "tags", "assets", "asset-files",
  "presentation-preferences", "evidence", "evidence-lifecycle", "review-commits", "snapshots",
  "restore-receipts", "provenance", "person-edits", "media-binding-receipts",
] as const;

const SHARED_DIRECTORIES = ["library", "sources"] as const;
const MAX_PACK_BYTES = 256 * 1024 * 1024;

export async function exportPersonalPack(): Promise<{ bytes: Uint8Array; fileName: string }> {
  const root = getConfiguredPrivateLibraryPath();
  if (!root) throw new Error("请先配置 Private Library，再导出 Personal Pack。");

  const manifest: PortablePackManifest = {
    schemaVersion: 1,
    kind: "personal-backup",
    id: `personal_${randomUUID()}`,
    name: "Localogue Personal Backup",
    version: timestampVersion(),
    createdAt: new Date().toISOString(),
    description: "Private Library metadata/assets backup. MediaFile paths and instance settings are intentionally excluded.",
  };
  const files: PortablePackFile[] = [];
  for (const directory of PERSONAL_DIRECTORIES) {
    files.push(...await collectFiles(root, directory, directory === "asset-files"));
  }
  const envelope: PortablePackEnvelope = { schemaVersion: 1, format: "localogue-portable-pack", manifest, files };
  const bytes = encodePortablePack(envelope);
  assertPortableSize(bytes);
  return { bytes, fileName: `localogue-personal-${manifest.version}.localogue-pack` };
}

export async function exportSharedPack(configuredPath: string): Promise<{ bytes: Uint8Array; fileName: string }> {
  const settings = readInstanceSettings();
  if (!settings.sharedPackPaths.includes(configuredPath)) throw new Error("只能导出当前实例已经配置的 Shared Pack。");
  const resolved = resolveSharedPack(configuredPath);
  if (!resolved.valid || !resolved.manifest) throw new Error(resolved.error ?? "Shared Pack 无效。");

  const validation = await validateCommunityPackRoot(resolved.absolutePath);
  if (!validation.valid) {
    throw new Error(`Shared Pack 未通过 Community Validator：${validation.errors.slice(0, 5).join("；")}`);
  }

  const files: PortablePackFile[] = [];
  files.push(makePortableFile("localogue-pack.json", await readFile(path.join(resolved.absolutePath, "localogue-pack.json"))));
  for (const directory of SHARED_DIRECTORIES) files.push(...await collectFiles(resolved.absolutePath, directory, false));
  const manifest: PortablePackManifest = {
    schemaVersion: 1,
    kind: "shared-library",
    id: `portable_${randomUUID()}`,
    name: `${resolved.manifest.name} Portable Archive`,
    version: resolved.manifest.version,
    createdAt: new Date().toISOString(),
    sourcePackId: resolved.manifest.id,
    sourcePackVersion: resolved.manifest.version,
  };
  const bytes = encodePortablePack({ schemaVersion: 1, format: "localogue-portable-pack", manifest, files });
  assertPortableSize(bytes);
  return {
    bytes,
    fileName: `${safeName(resolved.manifest.id)}-${safeName(resolved.manifest.version)}.localogue-pack`,
  };
}

export async function previewPortablePack(bytes: Uint8Array): Promise<PortablePackPreview> {
  if (bytes.byteLength > MAX_PACK_BYTES) throw new Error("V1-11 Portable Pack 暂时限制为 256 MB。");
  const envelope = decodeAndValidateEnvelope(bytes);
  const errors: string[] = [];
  const warnings: string[] = [];
  const conflicts: string[] = [];

  if (envelope.manifest.kind === "personal-backup") {
    const root = getConfiguredPrivateLibraryPath();
    if (!root) errors.push("当前没有配置 Private Library，不能导入 Personal Pack。");
    for (const file of envelope.files) {
      if (!isAllowedPersonalPath(file.path)) errors.push(`${file.path}: 不属于 Personal Pack 允许目录。`);
      if (root && await exists(path.join(root, ...file.path.split("/")))) conflicts.push(file.path);
    }
    if (conflicts.length) warnings.push(`有 ${conflicts.length} 个文件已经存在；V1-11 导入会安全跳过，不覆盖。`);
  } else {
    if (!envelope.files.some((file) => file.path === "localogue-pack.json")) errors.push("Shared Pack 缺少 localogue-pack.json。");
    if (!envelope.files.some((file) => file.path.startsWith("library/"))) warnings.push("Shared Pack 当前没有任何 library 文件。空 Pack 可以安装，但不会提供实体。 ");
  }

  return {
    manifest: envelope.manifest,
    fileCount: envelope.files.length,
    totalBytes: envelope.files.reduce((sum, file) => sum + file.size, 0),
    errors,
    warnings,
    conflicts,
    importable: errors.length === 0,
  };
}

export async function importPortablePack(bytes: Uint8Array): Promise<PortablePackImportResult> {
  const preview = await previewPortablePack(bytes);
  if (!preview.importable) throw new Error(preview.errors.join("；"));
  const envelope = decodeAndValidateEnvelope(bytes);
  return envelope.manifest.kind === "personal-backup"
    ? importPersonalEnvelope(envelope)
    : installSharedEnvelope(envelope);
}

async function importPersonalEnvelope(envelope: PortablePackEnvelope): Promise<PortablePackImportResult> {
  const root = getConfiguredPrivateLibraryPath();
  if (!root) throw new Error("当前没有配置 Private Library。");
  let imported = 0;
  let skipped = 0;
  const created: string[] = [];
  try {
    for (const file of envelope.files) {
      if (!isAllowedPersonalPath(file.path)) throw new Error(`${file.path}: 不允许导入到 Private Library。`);
      const target = safeJoin(root, file.path);
      if (await exists(target)) { skipped += 1; continue; }
      await atomicWrite(target, decodePortableFile(file));
      created.push(target);
      imported += 1;
    }
  } catch (error) {
    for (const target of created.reverse()) await rm(target, { force: true });
    throw error;
  }
  return {
    kind: "personal-backup",
    imported,
    skipped,
    warnings: skipped ? [`跳过 ${skipped} 个已经存在的本地文件；V1-11 默认不覆盖。`] : [],
  };
}

async function installSharedEnvelope(envelope: PortablePackEnvelope): Promise<PortablePackImportResult> {
  const settings = readInstanceSettings();
  const installBase = path.join(process.cwd(), ".localogue", "packs");
  const token = `${safeName(envelope.manifest.sourcePackId ?? envelope.manifest.id)}-${safeName(envelope.manifest.sourcePackVersion ?? envelope.manifest.version)}`;
  const finalRoot = path.join(installBase, token);
  const temporaryRoot = `${finalRoot}.tmp-${randomUUID().slice(0, 8)}`;
  await rm(temporaryRoot, { recursive: true, force: true });
  await mkdir(temporaryRoot, { recursive: true });
  try {
    for (const file of envelope.files) {
      if (!isAllowedSharedPath(file.path)) throw new Error(`${file.path}: Shared Pack 包含不允许的路径。`);
      await atomicWrite(safeJoin(temporaryRoot, file.path), decodePortableFile(file));
    }
    const validation = await validateCommunityPackRoot(temporaryRoot);
    if (!validation.valid) throw new Error(`Community Pack 校验失败：${validation.errors.slice(0, 10).join("；")}`);

    const alreadyInstalled = await exists(finalRoot);
    if (alreadyInstalled) {
      const existingValidation = await validateCommunityPackRoot(finalRoot);
      if (!existingValidation.valid) {
        throw new Error(`同版本 Pack 已存在但校验失败，请先人工处理：${existingValidation.errors.slice(0, 5).join("；")}`);
      }
      await rm(temporaryRoot, { recursive: true, force: true });
    } else {
      await mkdir(path.dirname(finalRoot), { recursive: true });
      await rename(temporaryRoot, finalRoot);
    }

    const configuredPath = path.relative(process.cwd(), finalRoot) || finalRoot;
    const sharedPackPaths = settings.sharedPackPaths.includes(configuredPath)
      ? settings.sharedPackPaths
      : [...settings.sharedPackPaths, configuredPath];
    saveInstanceSettings({ ...settings, sharedPackPaths });
    return {
      kind: "shared-library",
      imported: alreadyInstalled ? 0 : envelope.files.length,
      skipped: alreadyInstalled ? envelope.files.length : 0,
      installedPath: finalRoot,
      sharedPackPath: configuredPath,
      warnings: [
        ...validation.warnings,
        ...(alreadyInstalled ? ["同 ID / Version Shared Pack 已经安装，本次复用现有安装目录。"] : []),
      ],
    };
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

function decodeAndValidateEnvelope(bytes: Uint8Array): PortablePackEnvelope {
  const envelope = decodePortablePack(bytes);
  if (!envelope.manifest.id?.trim() || !envelope.manifest.name?.trim() || !envelope.manifest.version?.trim()) {
    throw new Error("Portable Pack manifest 缺少 id / name / version。");
  }
  const seen = new Set<string>();
  for (const file of envelope.files) {
    file.path = normalizePackPath(file.path);
    if (seen.has(file.path)) throw new Error(`Portable Pack 存在重复路径：${file.path}`);
    seen.add(file.path);
    decodePortableFile(file); // 提前做 size + SHA-256 完整性校验。
  }
  return envelope;
}

async function collectFiles(root: string, relativeDirectory: string, binary: boolean): Promise<PortablePackFile[]> {
  const directory = safeJoin(root, relativeDirectory);
  let names: string[];
  try { names = await readdir(directory); }
  catch (error) { if (isMissing(error)) return []; throw error; }
  const files: PortablePackFile[] = [];
  for (const name of names.sort()) {
    const absolute = path.join(directory, name);
    const info = await stat(absolute);
    const relative = `${relativeDirectory}/${name}`.replaceAll("\\", "/");
    if (info.isDirectory()) files.push(...await collectFiles(root, relative, binary));
    else if (info.isFile()) files.push(makePortableFile(relative, await readFile(absolute), binary));
  }
  return files;
}

function isAllowedPersonalPath(value: string): boolean {
  const first = normalizePackPath(value).split("/")[0];
  return PERSONAL_DIRECTORIES.includes(first as (typeof PERSONAL_DIRECTORIES)[number]);
}
function isAllowedSharedPath(value: string): boolean {
  const normalized = normalizePackPath(value);
  return normalized === "localogue-pack.json" || SHARED_DIRECTORIES.some((directory) => normalized.startsWith(`${directory}/`));
}
function safeJoin(root: string, relativePath: string): string {
  const normalized = normalizePackPath(relativePath);
  const target = path.resolve(root, ...normalized.split("/"));
  const base = path.resolve(root);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new Error(`Pack 路径越界：${relativePath}`);
  return target;
}
async function atomicWrite(target: string, bytes: Uint8Array) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${randomUUID().slice(0, 8)}`;
  await writeFile(temporary, bytes);
  await rename(temporary, target);
}
async function exists(filePath: string): Promise<boolean> { try { await access(filePath); return true; } catch { return false; } }
function isMissing(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"; }
function assertPortableSize(bytes: Uint8Array) { if (bytes.byteLength > MAX_PACK_BYTES) throw new Error("V1-11 Portable Pack 暂时限制为 256 MB；请减少 Asset，或继续使用目录/Git 方式迁移大 Pack。"); }
function timestampVersion(): string { return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
function safeName(value: string): string { return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-"); }
