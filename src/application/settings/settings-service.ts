import { promises as fsp } from "node:fs";
import path from "node:path";

import type { InstanceSettings } from "@/domain/entities/instance-settings";
import {
  addLibraryProfile,
  applyLibraryProfile,
  createEmptyLibraryProfile,
  createLibraryProfileId,
  ensureLibraryProfiles,
  renameLibraryProfile,
  removeLibraryProfile,
  syncActiveLibraryProfile,
  type LibraryProfile,
} from "@/domain/entities/library-profile";
import { getEffectiveLibraryConfiguration } from "@/infrastructure/repositories/library-path";
import {
  getInstanceSettingsPath,
  readInstanceSettings,
  saveInstanceSettings,
} from "@/infrastructure/settings/instance-settings-store";

export interface SettingsOverview {
  settings: InstanceSettings;
  settingsPath: string;
  effective: ReturnType<typeof getEffectiveLibraryConfiguration>;
}

export function getSettingsOverview(): SettingsOverview {
  return {
    settings: readInstanceSettings(),
    settingsPath: getInstanceSettingsPath(),
    effective: getEffectiveLibraryConfiguration(),
  };
}

/**
 * 更新实例级设置。
 *
 * 保存 libraryPath 时只创建根目录，不自动复制 Demo 数据。
 * 一个真正的私人资料库可以从“空库 + Shared Pack”开始，不应该被迫混入教学 Demo。
 *
 * 新版同时支持 Library Profile：传入的平面路径字段会被写回当前激活的 Profile，
 * 因此切换资料库后各自独立保存，不会互相覆盖。
 */
export async function updateInstanceSettings(input: unknown): Promise<SettingsOverview> {
  if (!isObject(input)) throw new Error("设置请求必须是 JSON 对象。");

  const libraryPath = optionalString(input.libraryPath);
  const sharedPackPaths = stringArray(input.sharedPackPaths, "sharedPackPaths");
  const libraryRoots = stringArray(input.libraryRoots, "libraryRoots");
  const mediaScanPaths = stringArray(input.mediaScanPaths, "mediaScanPaths");
  const nfoScanPaths = stringArray(input.nfoScanPaths, "nfoScanPaths");
  const ffprobePath = optionalStringField(input.ffprobePath, "ffprobePath");
  const ffmpegPath = optionalStringField(input.ffmpegPath, "ffmpegPath");

  const current = readInstanceSettings();
  const draft: InstanceSettings = {
    ...current,
    ...(libraryPath ? { libraryPath } : { libraryPath: undefined }),
    sharedPackPaths,
    ...(libraryRoots.length ? { libraryRoots } : { libraryRoots: [] }),
    ...(mediaScanPaths.length ? { mediaScanPaths } : { mediaScanPaths: [] }),
    ...(nfoScanPaths.length ? { nfoScanPaths } : { nfoScanPaths: [] }),
    ...(ffprobePath ? { ffprobePath } : { ffprobePath: undefined }),
    ...(ffmpegPath ? { ffmpegPath } : { ffmpegPath: undefined }),
  };
  const synced = syncActiveLibraryProfile(draft) as InstanceSettings;
  const saved = saveInstanceSettings(synced);

  if (saved.libraryPath) {
    const absolutePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), saved.libraryPath);
    await fsp.mkdir(absolutePath, { recursive: true });
  }

  return getSettingsOverview();
}

/** 切换到指定 Profile；不存在时回退到第一个 Profile。 */
export function switchProfile(id: string): SettingsOverview {
  const current = readInstanceSettings();
  const target = (current.libraryProfiles ?? []).find((profile) => profile.id === id) ?? (current.libraryProfiles ?? [])[0];
  if (!target) throw new Error("没有可切换的资料库 Profile。");
  const saved = saveInstanceSettings(applyLibraryProfile(current, target) as InstanceSettings);
  return getSettingsOverviewWith(saved);
}

/** 新建一个空白资料库 Profile 并立即切换过去。 */
export function createProfile(name?: string): SettingsOverview {
  const current = ensureLibraryProfiles(readInstanceSettings());
  const profileName = (name?.trim()) || nextProfileName(current);
  const profile = createEmptyLibraryProfile(createLibraryProfileId(), profileName);
  const saved = saveInstanceSettings(addLibraryProfile(current, profile) as InstanceSettings);
  return getSettingsOverviewWith(saved);
}

/** 重命名一个 Profile（不影响其资料库目录）。 */
export function renameProfile(id: string, name: string): SettingsOverview {
  const current = readInstanceSettings();
  if (!(current.libraryProfiles ?? []).some((profile) => profile.id === id)) {
    throw new Error("找不到要重命名的资料库 Profile。");
  }
  const saved = saveInstanceSettings(renameLibraryProfile(current, id, name) as InstanceSettings);
  return getSettingsOverviewWith(saved);
}

/** 删除一个 Profile；若删除的是当前激活项，则回退到剩余第一个。 */
export function deleteProfile(id: string): SettingsOverview {
  const current = readInstanceSettings();
  const saved = saveInstanceSettings(removeLibraryProfile(current, id) as InstanceSettings);
  return getSettingsOverviewWith(saved);
}

/**
 * 初始化示例库：把教学 Demo 复制到 data/library，并确保存在一个指向它的“示例库” Profile。
 * 与桌面端“添加示例库”对齐，让网页端也能一键看到可浏览的演示资料。
 */
export async function seedDemoLibrary(): Promise<SettingsOverview> {
  const targetRoot = path.join(process.cwd(), "data", "library");
  const sourceRoot = path.join(process.cwd(), "data", "demo-library");
  const canonicalCollections = [
    "works",
    "people",
    "organizations",
    "series",
    "genres",
    "tags",
    "assets",
    "media-files",
    "presentation-preferences",
    "media-binding-receipts",
  ];

  await fsp.mkdir(targetRoot, { recursive: true });
  await fsp.mkdir(path.join(targetRoot, "asset-files"), { recursive: true });
  for (const collection of canonicalCollections) {
    await fsp.mkdir(path.join(targetRoot, collection), { recursive: true });
  }

  for (const collection of canonicalCollections) {
    const source = path.join(sourceRoot, collection);
    const target = path.join(targetRoot, collection);
    let names: string[] = [];
    try {
      names = (await fsp.readdir(source)).filter((item) => item.endsWith(".json"));
    } catch {
      continue;
    }
    const existing = new Set(await fsp.readdir(target));
    for (const name of names) {
      if (existing.has(name)) continue;
      await fsp.cp(path.join(source, name), path.join(target, name));
    }
  }

  const current = ensureLibraryProfiles(readInstanceSettings());
  const existingExample = (current.libraryProfiles ?? []).find((profile) => profile.name === "示例库");
  let next: InstanceSettings;
  if (existingExample) {
    const updated: LibraryProfile = { ...existingExample, libraryPath: "./data/library", updatedAt: new Date().toISOString() };
    next = addLibraryProfile(current, updated);
  } else {
    const profile = createEmptyLibraryProfile(createLibraryProfileId(), "示例库");
    profile.libraryPath = "./data/library";
    next = addLibraryProfile(current, profile);
  }

  const saved = saveInstanceSettings(ensureLibraryProfiles(next) as InstanceSettings);
  return getSettingsOverviewWith(saved);
}

function getSettingsOverviewWith(settings: InstanceSettings): SettingsOverview {
  return {
    settings,
    settingsPath: getInstanceSettingsPath(),
    effective: getEffectiveLibraryConfiguration(),
  };
}

function nextProfileName(settings: InstanceSettings): string {
  const names = new Set((settings.libraryProfiles ?? []).map((profile) => profile.name.trim()));
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `资料库 ${index}`;
    if (!names.has(candidate)) return candidate;
  }
  return `资料库 ${Date.now()}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error("libraryPath 必须是字符串。");
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes("\0")) throw new Error("libraryPath 不能包含 NUL 字符。");
  return trimmed;
}

function optionalStringField(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${fieldName} 必须是字符串。`);
  const trimmed = value.trim();
  if (trimmed.includes("\0")) throw new Error(`${fieldName} 不能包含 NUL 字符。`);
  return trimmed || undefined;
}

function stringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${fieldName} 必须是字符串数组。`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}
