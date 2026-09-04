import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";

import type { Asset } from "@/domain/entities/asset";

import { desktopBridge } from "./tauri-bridge";

interface DesktopAssetImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  asset?: Asset | null;
  fallback?: ReactNode;
}

/**
 * Desktop 不为任意文件路径开启 Tauri asset:// 全盘 scope。
 *
 * 图片由受限 Native Command 按 Asset.id 解析真实来源：Private Library 优先，其次是当前
 * Profile 已挂载且通过 manifest 校验的 Shared Pack。每个来源都只能读取自己的 asset-files/，
 * 并且必须存在与 Asset.id + storagePath 一致的 Asset JSON。WebView 因此不会获得任意本地文件读取能力。
 */
export function DesktopAssetImage({ asset, fallback = null, alt = "", ...props }: DesktopAssetImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);

    if (!asset) return () => undefined;

    void desktopBridge.readResolvedAssetBytes(asset.id, asset.storagePath)
      .then((value) => {
        if (disposed) return;
        const bytes = new Uint8Array(value);
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: asset.mimeType ?? "application/octet-stream" }));
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset?.id, asset?.storagePath, asset?.mimeType]);

  if (!asset || failed || !url) return <>{fallback}</>;
  return <img {...props} alt={alt} src={url} />;
}
