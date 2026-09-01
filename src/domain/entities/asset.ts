export type AssetType =
  | "cover"
  | "poster"
  | "fanart"
  | "screenshot"
  | "portrait"
  | "gallery"
  | "logo"
  | "subtitle"
  | "other";

/**
 * Asset 只保存资源的“描述和位置”，不把二进制图片塞进 JSON。
 */
export interface Asset {
  schemaVersion: number;
  id: string;
  type: AssetType;
  storagePath: string;
  mimeType?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  sha256?: string;
  sourceUrl?: string;
  createdAt?: string;
}
