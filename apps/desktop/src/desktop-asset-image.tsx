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
 * 图片由受限 Native Command 从当前 Private Library/asset-files 读取成原始 IPC bytes，
 * React 再创建生命周期受控的 Blob URL。这样既能显示本地海报，又不会把 WebView 变成
 * 任意本地文件读取器。
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

    void desktopBridge.readPrivateAssetBytes(asset.storagePath)
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
