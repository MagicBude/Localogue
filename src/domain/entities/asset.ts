export type AssetType =
  | "cover"
  | "poster"
  | "fanart"
  | "screenshot"
  | "portrait"
  | "gallery"
  | "logo"
  | "subtitle"
  | "document"
  | "other";

export type AssetSubjectType = "person" | "work";

/**
 * Asset 只保存资源的“描述和位置”，不把二进制图片塞进 JSON。
 *
 * V1-10 新增 subjectType / subjectId：
 * - Community Person / Work 不需要为了用户自己的头像或封面被整实体复制；
 * - 本地 Asset 可以独立声明“它属于哪个人物/作品”；
 * - Presentation Preference 再决定最终展示哪一张。
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
  subjectType?: AssetSubjectType;
  subjectId?: string;
  createdAt?: string;
}
