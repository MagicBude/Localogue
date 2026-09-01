import type { LocalizedText } from "@/domain/value-objects/localized-text";
import type { PartialDate } from "@/domain/value-objects/partial-date";

export type PersonRole = "performer" | "director" | "photographer" | "other";

export interface WorkPersonRelation {
  personId: string;
  role: PersonRole;
  billingOrder?: number;
}

/**
 * Work 表示“作品”本身，而不是硬盘中的视频文件。
 *
 * 这是 Localogue 的关键建模原则：
 * - 作品可以已经被收录，但用户尚未拥有媒体文件；
 * - 同一个作品也可以关联多个清晰度、字幕版本或不同编码的媒体文件。
 */
export interface Work {
  schemaVersion: number;
  id: string;
  code: string;
  originalLanguage: "ja" | "zh-CN" | "en";
  titles: LocalizedText;
  descriptions?: LocalizedText;
  releaseDate?: PartialDate;
  durationMinutes?: number;
  workTypeIds: string[];
  personRelations: WorkPersonRelation[];
  makerId?: string;
  labelId?: string;
  seriesIds: string[];
  genreIds: string[];
  tagIds: string[];
  assetIds: string[];
  mediaFileIds: string[];
  createdAt: string;
  updatedAt: string;
}
