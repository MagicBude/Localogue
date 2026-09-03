/**
 * Evidence（证据）表示“一次外部输入告诉了 Localogue 什么”。
 *
 * 重要：Evidence 不是正式作品，也不能直接替代 Canonical Library。
 * 它保留来源、原始内容、规范化结果和解析警告，供后续 Review 审核使用。
 */
export type EvidenceSourceType =
  | "localogue_json"
  | "nfo"
  | "csv"
  | "xlsx"
  | "manual"
  | "folder_scan"
  | "connector";

export type ImportWarningCode =
  | "missing_code"
  | "missing_title"
  | "invalid_duration"
  | "missing_performers"
  | "json_row_not_object"
  | "xlsx_fallback_sheet"
  | "unmapped_classification";

export interface ImportWarning {
  code: ImportWarningCode;
  detail?: string;
}

export interface NormalizedImportCandidate {
  code?: string;
  title?: string;
  originalTitle?: string;
  releaseDate?: string;
  durationMinutes?: number;
  performers: string[];
  directors: string[];
  maker?: string;
  label?: string;
  series: string[];
  genres: string[];
  tags: string[];
  workTypes: string[];
  description?: string;
}

export interface ImportCandidate {
  /** 导入文件中的第几条记录，从 1 开始，便于 UI 给人看。 */
  index: number;
  raw: unknown;
  normalized: NormalizedImportCandidate;
  warnings: ImportWarning[];
}

export interface ImportPreview {
  sourceType: EvidenceSourceType;
  sourceName: string;
  candidateCount: number;
  candidates: ImportCandidate[];
  warnings: ImportWarning[];
}

export interface EvidenceRecord {
  schemaVersion: 1;
  id: string;
  sourceType: EvidenceSourceType;
  sourceName: string;
  importedAt: string;
  sourcePath?: string;
  raw: unknown;
  normalized: NormalizedImportCandidate;
  warnings: ImportWarning[];
}
