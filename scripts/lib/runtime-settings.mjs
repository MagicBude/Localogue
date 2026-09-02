import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * 独立 Node 脚本不会经过 Next.js，因此这里复刻“最小必要”的运行时设置解析。
 * 目标不是把应用逻辑再写一遍，而是保证 pnpm validate:* 与网页看到同一套路径。
 */
export function loadLocalEnv() {
  try {
    process.loadEnvFile(path.join(process.cwd(), ".env.local"));
  } catch {
    // .env.local 可选。
  }
}

export function readInstanceSettings() {
  const settingsPath = process.env.LOCALOGUE_SETTINGS_PATH?.trim()
    ? path.resolve(process.cwd(), process.env.LOCALOGUE_SETTINGS_PATH.trim())
    : path.join(process.cwd(), ".localogue", "settings.json");
  try {
    const parsed = JSON.parse(readFileSync(settingsPath, "utf8"));
    return {
      libraryPath: typeof parsed.libraryPath === "string" ? parsed.libraryPath.trim() : "",
      sharedPackPaths: normalizeStringArray(parsed.sharedPackPaths),
      mediaScanPaths: normalizeStringArray(parsed.mediaScanPaths),
      ffprobePath: typeof parsed.ffprobePath === "string" ? parsed.ffprobePath.trim() : "",
    };
  } catch (error) {
    if (error?.code === "ENOENT") return { libraryPath: "", sharedPackPaths: [], mediaScanPaths: [], ffprobePath: "" };
    throw new Error(`无法读取 Localogue 实例设置：${error.message}`);
  }
}

export function resolvePrivateLibraryRoot() {
  loadLocalEnv();
  const env = process.env.LOCALOGUE_LIBRARY_PATH?.trim();
  if (env) return path.resolve(process.cwd(), env);
  const settings = readInstanceSettings();
  return settings.libraryPath ? path.resolve(process.cwd(), settings.libraryPath) : null;
}

export function resolvePrivateRuntimeRoot() {
  return resolvePrivateLibraryRoot() ?? path.join(process.cwd(), "data", "library");
}

export function resolveReadableLibraryRoots() {
  const privateRoot = resolvePrivateLibraryRoot();
  const settings = readInstanceSettings();
  const sharedRoots = settings.sharedPackPaths
    .map((configured) => {
      const packRoot = path.resolve(process.cwd(), configured);
      const manifest = path.join(packRoot, "localogue-pack.json");
      const library = path.join(packRoot, "library");
      if (!existsSync(manifest) || !existsSync(library)) return null;
      try {
        const parsed = JSON.parse(readFileSync(manifest, "utf8"));
        if (parsed.schemaVersion !== 1 || parsed.kind !== "shared-library" || !parsed.id || !parsed.name || !parsed.version) return null;
        return library;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const realRoots = [...(privateRoot ? [privateRoot] : []), ...sharedRoots];
  return realRoots.length ? realRoots : [path.join(process.cwd(), "data", "demo-library")];
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];
}
