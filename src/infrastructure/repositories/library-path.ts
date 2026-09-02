import path from "node:path";

import type { PrivateLibraryPathSource } from "@/domain/entities/instance-settings";
import type { ResolvedSharedPack } from "@/domain/entities/shared-pack";
import { readInstanceSettings } from "@/infrastructure/settings/instance-settings-store";
import { resolveSharedPacks } from "@/infrastructure/shared-packs/shared-pack-resolver";

export interface EffectiveLibraryConfiguration {
  privateLibraryPath: string | null;
  privateLibraryPathSource: PrivateLibraryPathSource;
  readableRoots: string[];
  sharedPacks: ResolvedSharedPack[];
  demoMode: boolean;
}

/**
 * 私人 Library 路径优先级：
 *
 * 1. LOCALOGUE_LIBRARY_PATH 环境变量（部署/管理员强制覆盖）
 * 2. /settings 保存的实例设置
 * 3. 未配置私人 Library
 *
 * 环境变量优先级最高是有意设计：Docker / systemd / 服务器部署时，运维配置
 * 不应该被一个浏览器页面悄悄覆盖。设置页会明确显示当前是否被环境变量接管。
 */
export function getConfiguredPrivateLibraryPath(): string | null {
  return getPrivateLibraryPathResolution().path;
}

export function getPrivateLibraryPathSource(): PrivateLibraryPathSource {
  return getPrivateLibraryPathResolution().source;
}

export function getReadableLibraryRoots(): string[] {
  return getEffectiveLibraryConfiguration().readableRoots;
}

/** 保留旧名字，方便文档与少量调用点渐进迁移；第一个根即最高优先级。 */
export function getReadableLibraryPath(): string {
  return getReadableLibraryRoots()[0];
}

/**
 * Evidence / Audit 等私人运行数据的写入目录。
 * 即使没有启用 Canonical 写入，也允许先把 Evidence 安全保存到 Git 忽略的 data/library。
 */
export function getPrivateRuntimeLibraryPath(): string {
  return getConfiguredPrivateLibraryPath() ?? path.join(process.cwd(), "data", "library");
}

export function isPrivateLibraryConfigured(): boolean {
  return getConfiguredPrivateLibraryPath() !== null;
}

export function getEffectiveLibraryConfiguration(): EffectiveLibraryConfiguration {
  const settings = readInstanceSettings();
  const privateResolution = getPrivateLibraryPathResolution(settings.libraryPath);
  const sharedPacks = resolveSharedPacks(settings.sharedPackPaths);
  const validSharedRoots = sharedPacks
    .filter((pack) => pack.valid && pack.libraryPath)
    .map((pack) => pack.libraryPath as string);

  // 读取优先级：Local > Shared Pack 1 > Shared Pack 2 > ...
  const realRoots = [
    ...(privateResolution.path ? [privateResolution.path] : []),
    ...validSharedRoots,
  ];

  const demoMode = realRoots.length === 0;
  return {
    privateLibraryPath: privateResolution.path,
    privateLibraryPathSource: privateResolution.source,
    readableRoots: demoMode
      ? [path.join(process.cwd(), "data", "demo-library")]
      : realRoots,
    sharedPacks,
    demoMode,
  };
}

function getPrivateLibraryPathResolution(settingsLibraryPath?: string): {
  path: string | null;
  source: PrivateLibraryPathSource;
} {
  const environmentPath = process.env.LOCALOGUE_LIBRARY_PATH?.trim();
  if (environmentPath) {
    return {
      path: path.resolve(/* turbopackIgnore: true */ process.cwd(), environmentPath),
      source: "environment",
    };
  }

  const configured = settingsLibraryPath ?? readInstanceSettings().libraryPath;
  if (configured?.trim()) {
    return {
      path: path.resolve(/* turbopackIgnore: true */ process.cwd(), configured.trim()),
      source: "settings",
    };
  }

  return { path: null, source: null };
}
