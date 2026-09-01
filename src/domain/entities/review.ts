import type { ImportWarning } from "@/domain/entities/evidence";

/**
 * V1-05 的 Review 只做“分析”，不直接修改 Canonical Library。
 *
 * 这里刻意把 Evidence、Review Analysis、Canonical Entity 分开：
 * - Evidence：外部输入的原始证据；
 * - ReviewAnalysis：系统基于当前资料库给出的匹配与差异分析；
 * - Canonical Entity：用户确认后才允许修改的正式实体。
 */
export type EntityResolutionStatus =
  | "matched"
  | "new"
  | "ambiguous"
  | "unresolved";

export interface EntityResolutionCandidate {
  id: string;
  label: string;
}

export interface EntityResolution {
  sourceValue: string;
  status: EntityResolutionStatus;
  matchedId?: string;
  matchedLabel?: string;
  candidates: EntityResolutionCandidate[];
}

export type WorkResolutionStatus =
  | "existing_clean"
  | "existing_conflict"
  | "new_work"
  | "missing_code";

export type FieldComparisonStatus =
  | "same"
  | "different"
  | "evidence_only"
  | "library_only";

export type ReviewFieldValue = string | number | string[] | null;

export interface ReviewFieldComparison {
  field:
    | "code"
    | "title"
    | "releaseDate"
    | "durationMinutes"
    | "description"
    | "performers"
    | "directors"
    | "maker"
    | "label"
    | "series"
    | "genres"
    | "tags"
    | "workTypes";
  status: FieldComparisonStatus;
  evidenceValue: ReviewFieldValue;
  libraryValue: ReviewFieldValue;
}

export interface EvidenceReviewAnalysis {
  evidenceId: string;
  sourceName: string;
  sourceType: string;
  importedAt: string;
  code?: string;
  title?: string;
  workStatus: WorkResolutionStatus;
  matchedWorkId?: string;
  warnings: ImportWarning[];
  comparisons: ReviewFieldComparison[];
  performers: EntityResolution[];
  directors: EntityResolution[];
  maker?: EntityResolution;
  label?: EntityResolution;
  series: EntityResolution[];
  genres: EntityResolution[];
  tags: EntityResolution[];
  workTypes: EntityResolution[];
  summary: {
    matchedEntities: number;
    newEntities: number;
    ambiguousEntities: number;
    unresolvedEntities: number;
    conflictingFields: number;
  };
}
