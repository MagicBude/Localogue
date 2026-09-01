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
}
