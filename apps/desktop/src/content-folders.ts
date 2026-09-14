import type { DesktopContentFolder, DesktopLibraryProfile } from "./contracts";

/**
 * 将旧版三组路径无损折叠成一组带扫描范围的内容目录。
 * 同一路径出现多次时合并开关，不会产生重复扫描配置。
 */
export function normalizeContentFolders(settings: Pick<DesktopLibraryProfile, "contentFolders">): DesktopContentFolder[] {
  const byPath = new Map<string, DesktopContentFolder>();
  const add = (path: string, scope: Omit<DesktopContentFolder, "path">) => {
    const cleaned = path.trim();
    if (!cleaned) return;
    const key = normalizePath(cleaned);
    const current = byPath.get(key);
    byPath.set(key, current ? {
      path: current.path,
      scanVideo: current.scanVideo || scope.scanVideo,
      scanNfo: current.scanNfo || scope.scanNfo,
      scanImages: current.scanImages || scope.scanImages,
    } : { path: cleaned, ...scope });
  };

  for (const folder of settings.contentFolders) add(folder.path, folder);
  return [...byPath.values()].filter((folder) => folder.scanVideo || folder.scanNfo || folder.scanImages);
}

/** 保存时生成旧字段镜像，让旧 Native Runtime 与回退版本仍能打开同一设置。 */
export function contentFolderRoots(settings: Pick<DesktopLibraryProfile, "contentFolders">, kind: "video" | "nfo" | "images"): string[] {
  const property = kind === "video" ? "scanVideo" : kind === "nfo" ? "scanNfo" : "scanImages";
  return normalizeContentFolders(settings).filter((folder) => folder[property]).map((folder) => folder.path);
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+$/, "").toLocaleLowerCase();
}
