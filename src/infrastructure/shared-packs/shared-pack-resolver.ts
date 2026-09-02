import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { ResolvedSharedPack, SharedPackManifest } from "@/domain/entities/shared-pack";

const MANIFEST_NAME = "localogue-pack.json";

/**
 * Shared Pack 目录约定：
 *
 * pack-root/
 * ├── localogue-pack.json
 * └── library/
 *     ├── works/
 *     ├── people/
 *     └── ...
 *
 * V1-09 把 Pack 挂载为只读基础资料，不会把 Pack 自身改写。
 */
export function resolveSharedPack(configuredPath: string): ResolvedSharedPack {
  const absolutePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), configuredPath);
  const manifestPath = path.join(absolutePath, MANIFEST_NAME);
  const libraryPath = path.join(absolutePath, "library");

  try {
    if (!existsSync(manifestPath)) {
      return invalid(configuredPath, absolutePath, `缺少 ${MANIFEST_NAME}`);
    }
    if (!existsSync(libraryPath)) {
      return invalid(configuredPath, absolutePath, "缺少 library/ 目录");
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as SharedPackManifest;
    validateManifest(manifest);
    return {
      configuredPath,
      absolutePath,
      libraryPath,
      valid: true,
      manifest,
    };
  } catch (error) {
    return invalid(
      configuredPath,
      absolutePath,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function resolveSharedPacks(paths: readonly string[]): ResolvedSharedPack[] {
  return paths.map(resolveSharedPack);
}

function validateManifest(manifest: SharedPackManifest): void {
  if (manifest.schemaVersion !== 1) throw new Error("当前只支持 Shared Pack schemaVersion 1");
  if (manifest.kind !== "shared-library") throw new Error("当前只支持 kind=shared-library 的只读资料包");
  if (!manifest.id?.trim()) throw new Error("Pack manifest 缺少 id");
  if (!manifest.name?.trim()) throw new Error("Pack manifest 缺少 name");
  if (!manifest.version?.trim()) throw new Error("Pack manifest 缺少 version");
}

function invalid(configuredPath: string, absolutePath: string, error: string): ResolvedSharedPack {
  return {
    configuredPath,
    absolutePath,
    libraryPath: null,
    valid: false,
    manifest: null,
    error,
  };
}
