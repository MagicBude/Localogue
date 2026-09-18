import type { DesktopFileEntry } from "./contracts";
import { desktopBridge } from "./tauri-bridge";

const NFO_EXTENSIONS = new Set([".nfo"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const MAX_METADATA_FILES_PER_ROOT = 110_000;

export interface DesktopMetadataDiscovery {
  nfoEntries: DesktopFileEntry[];
  assetEntries: DesktopFileEntry[];
}

export interface DesktopMetadataProgress {
  phase: "discovering" | "parsing_nfo" | "importing_nfo" | "importing_assets";
  current: number;
  total: number;
  fileName?: string;
  message: string;
}

export type DesktopMetadataProgressHandler = (progress: DesktopMetadataProgress) => void;

/**
 * 用一次目录树遍历同时发现 NFO 与图片。
 *
 * 高级设置允许 NFO 与图片使用不同根目录，所以这里先按规范化根路径合并“需要发现的
 * 文件类型”。相同根只走一次 Native Walker；不同根仍各自扫描，而且只请求该根需要的
 * 扩展名。解析、匹配与写入继续留在各自 Importer 中。
 */
export async function discoverDesktopMetadataFiles(
  nfoRoots: readonly string[],
  assetRoots: readonly string[],
  onProgress?: DesktopMetadataProgressHandler,
): Promise<DesktopMetadataDiscovery> {
  const plans = new Map<string, { root: string; nfo: boolean; assets: boolean }>();
  addRoots(plans, nfoRoots, "nfo");
  addRoots(plans, assetRoots, "assets");

  const nfoEntries = new Map<string, DesktopFileEntry>();
  const assetEntries = new Map<string, DesktopFileEntry>();
  const plannedRoots = [...plans.values()];
  for (const [index, plan] of plannedRoots.entries()) {
    onProgress?.({ phase: "discovering", current: index, total: plannedRoots.length, message: `正在发现文件：${plan.root}` });
    const extensions = [
      ...(plan.nfo ? NFO_EXTENSIONS : []),
      ...(plan.assets ? IMAGE_EXTENSIONS : []),
    ];
    const entries = await desktopBridge.walkFiles({
      root: plan.root,
      extensions,
      includeHidden: false,
      maxFiles: MAX_METADATA_FILES_PER_ROOT,
    });
    for (const entry of entries) {
      const extension = fileExtension(entry.name);
      const key = normalizePath(entry.path);
      if (plan.nfo && NFO_EXTENSIONS.has(extension)) nfoEntries.set(key, entry);
      if (plan.assets && IMAGE_EXTENSIONS.has(extension)) assetEntries.set(key, entry);
    }
    onProgress?.({ phase: "discovering", current: index + 1, total: plannedRoots.length, message: `目录发现完成：${plan.root}` });
  }
  return { nfoEntries: [...nfoEntries.values()], assetEntries: [...assetEntries.values()] };
}

function addRoots(
  plans: Map<string, { root: string; nfo: boolean; assets: boolean }>,
  roots: readonly string[],
  kind: "nfo" | "assets",
): void {
  for (const rawRoot of roots) {
    const root = rawRoot.trim();
    if (!root) continue;
    const key = normalizePath(root);
    const plan = plans.get(key) ?? { root, nfo: false, assets: false };
    plan[kind] = true;
    plans.set(key, plan);
  }
}

function fileExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index).toLowerCase();
}

function normalizePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/\/+$/, "");
  return /Windows/i.test(navigator.userAgent) ? normalized.toLocaleLowerCase() : normalized;
}
