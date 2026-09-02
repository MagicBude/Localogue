import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { InstanceSettings } from "@/domain/entities/instance-settings";
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
 */
export async function updateInstanceSettings(input: unknown): Promise<SettingsOverview> {
  if (!isObject(input)) throw new Error("设置请求必须是 JSON 对象。");

  const libraryPath = optionalString(input.libraryPath);
  const sharedPackPaths = stringArray(input.sharedPackPaths);
  const saved = saveInstanceSettings({
    schemaVersion: 1,
    ...(libraryPath ? { libraryPath } : {}),
    sharedPackPaths,
  });

  if (saved.libraryPath) {
    const absolutePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), saved.libraryPath);
    await mkdir(absolutePath, { recursive: true });
  }

  return getSettingsOverview();
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

function stringArray(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("sharedPackPaths 必须是字符串数组。");
  }
  return value.map((item) => item.trim()).filter(Boolean);
}
