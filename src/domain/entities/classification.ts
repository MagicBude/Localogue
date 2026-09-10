import type { LocalizedText } from "@/domain/value-objects/localized-text";

/**
 * Genre 和 Tag 都是可展示名称，但语义完全不同：
 * - Genre：受控内容分类；
 * - Tag：用户自己的整理标签。
 */
export interface Genre {
  id: string;
  names: LocalizedText;
}

export interface Tag {
  id: string;
  names: LocalizedText;
  builtIn?: boolean;
  /** 用户用来整理私人 Tag 的分类名；它不是 Canonical Genre。 */
  category?: string;
  /** 分类和分类内 Tag 的显示顺序，不参与 WorkQuery 语义。 */
  categoryOrder?: number;
  sortOrder?: number;
}
