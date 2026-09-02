import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type { Asset } from "@/domain/entities/asset";
import { getReadableLibraryRoots } from "@/infrastructure/repositories/library-path";

export type ResolvedAssetContent =
  | { kind: "redirect"; url: string; asset: Asset }
  | { kind: "file"; absolutePath: string; asset: Asset };

/**
 * 找到 Asset 元数据真正来自哪个分层根目录，再安全解析它的 storagePath。
 *
 * 不能只拿“合并后的 Asset”然后相对 Private Library 拼路径，
 * 因为该 Asset 可能来自 Shared Pack。
 */
export async function resolveAssetContent(assetId: string): Promise<ResolvedAssetContent | null> {
  for (const root of getReadableLibraryRoots()) {
    const directory = path.join(root, "assets");
    let fileNames: string[];
    try {
      fileNames = await readdir(directory);
    } catch (error) {
      if (isMissing(error)) continue;
      throw error;
    }

    for (const fileName of fileNames.filter((item) => item.endsWith(".json"))) {
      const asset = JSON.parse(await readFile(path.join(directory, fileName), "utf8")) as Asset;
      if (asset.id !== assetId) continue;

      if (/^https?:\/\//i.test(asset.storagePath)) {
        return { kind: "redirect", url: asset.storagePath, asset };
      }
      if (asset.storagePath.startsWith("/")) {
        // Demo 等 public/ 下的站内资源。
        return { kind: "redirect", url: asset.storagePath, asset };
      }

      const absolutePath = path.resolve(root, asset.storagePath);
      const relative = path.relative(root, absolutePath);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`Asset ${asset.id} 的 storagePath 逃逸出资料库根目录。`);
      }
      await access(absolutePath);
      return { kind: "file", absolutePath, asset };
    }
  }
  return null;
}

function isMissing(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}
