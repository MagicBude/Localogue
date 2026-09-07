import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { InstanceSettings } from "@/domain/entities/instance-settings";
import {
  ensureLibraryProfiles,
  type LibraryProfile,
} from "@/domain/entities/library-profile";

const DEFAULT_SETTINGS: InstanceSettings = {
  schemaVersion: 1,
  sharedPackPaths: [],
};

/**
 * 实例设置放在仓库根目录 .localogue/settings.json。
 *
 * 为什么不用 data/library？
 * libraryPath 本身就是“去哪找资料库”的启动配置；如果把它存进资料库，
 * 在知道资料库路径之前反而无法读取这个设置，形成鸡生蛋问题。
 *
 * 为什么使用同步文件 API？
 * 设置文件很小，而且只在服务端请求边界读取。同步读取让 library-path.ts
 * 可以继续提供同步函数，避免为了一个几十字节配置把整个 Repository API 改成异步配置链。
 */
export function getInstanceSettingsPath(): string {
  const configured = process.env.LOCALOGUE_SETTINGS_PATH?.trim();
  return configured
    ? path.resolve(/* turbopackIgnore: true */ process.cwd(), configured)
    : path.join(process.cwd(), ".localogue", "settings.json");
}

export function readInstanceSettings(): InstanceSettings {
  try {
    const parsed = JSON.parse(readFileSync(getInstanceSettingsPath(), "utf8")) as Partial<InstanceSettings>;
    return ensureLibraryProfiles(normalizeSettings(parsed));
  } catch (error) {
    if (isMissingFileError(error)) return { ...DEFAULT_SETTINGS };
    // 设置损坏不能悄悄切换到另一个真实资料库，因此在服务器端明确抛错。
    throw new Error(`无法读取 Localogue 实例设置：${toErrorMessage(error)}`);
  }
}

/**
 * 读取并迁移为含 Library Profile 的形状（与 readInstanceSettings 等价，仅为语义清晰保留）。
 *
 * 旧的单实例设置（只有平面字段）会在内存中平滑升级成单个 Profile，
 * 平面字段保持等于当前激活 Profile，因此下游解析逻辑无需感知差异。
 */
export function readInstanceSettingsWithProfiles(): InstanceSettings {
  return readInstanceSettings();
}

export function saveInstanceSettings(input: InstanceSettings): InstanceSettings {
  const normalized = normalizeSettings(input);
  const settingsPath = getInstanceSettingsPath();
  const temporaryPath = `${settingsPath}.tmp`;
  mkdirSync(path.dirname(settingsPath), { recursive: true });

  const saved: InstanceSettings = {
    ...normalized,
    updatedAt: new Date().toISOString(),
  };

  writeFileSync(temporaryPath, `${JSON.stringify(saved, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, settingsPath);
  return saved;
}

function normalizeSettings(input: Partial<InstanceSettings>): InstanceSettings {
  const libraryPath = normalizeOptionalPath(input.libraryPath);
  const sharedPackPaths = normalizePathArray(input.sharedPackPaths);
  const libraryRoots = normalizePathArray(input.libraryRoots);
  const mediaScanPaths = normalizePathArray(input.mediaScanPaths);
  const nfoScanPaths = normalizePathArray(input.nfoScanPaths);
  const ffprobePath = normalizeOptionalPath(input.ffprobePath);
  const libraryProfiles = normalizeProfiles(input.libraryProfiles);

  return {
    schemaVersion: 1,
    ...(libraryPath ? { libraryPath } : {}),
    sharedPackPaths,
    ...(libraryRoots.length ? { libraryRoots } : {}),
    ...(mediaScanPaths.length ? { mediaScanPaths } : {}),
    ...(nfoScanPaths.length ? { nfoScanPaths } : {}),
    ...(ffprobePath ? { ffprobePath } : {}),
    ...(libraryProfiles.length ? { libraryProfiles } : {}),
    ...(typeof input.activeLibraryProfileId === "string" && input.activeLibraryProfileId
      ? { activeLibraryProfileId: input.activeLibraryProfileId }
      : {}),
    ...(typeof input.updatedAt === "string" ? { updatedAt: input.updatedAt } : {}),
  };
}

function normalizeProfiles(input: unknown): LibraryProfile[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is LibraryProfile => Boolean(item) && typeof item === "object" && typeof (item as LibraryProfile).id === "string")
    .map((profile) => ({
      id: profile.id,
      name: typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : "未命名资料库",
      ...(typeof profile.description === "string" && profile.description.trim() ? { description: profile.description.trim() } : {}),
      ...(typeof profile.libraryPath === "string" && profile.libraryPath.trim() ? { libraryPath: profile.libraryPath.trim() } : {}),
      libraryRoots: normalizePathArray(profile.libraryRoots),
      mediaScanPaths: normalizePathArray(profile.mediaScanPaths),
      nfoScanPaths: normalizePathArray(profile.nfoScanPaths),
      sharedPackPaths: normalizePathArray(profile.sharedPackPaths),
      createdAt: typeof profile.createdAt === "string" ? profile.createdAt : new Date().toISOString(),
      updatedAt: typeof profile.updatedAt === "string" ? profile.updatedAt : new Date().toISOString(),
    }));
}

function normalizePathArray(value: unknown): string[] {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map((item) => normalizeOptionalPath(item))
    .filter((item): item is string => Boolean(item))));
}

function normalizeOptionalPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes("\0")) throw new Error("路径不能包含 NUL 字符。");
  if (trimmed.length > 4096) throw new Error("路径过长。");
  return trimmed;
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
