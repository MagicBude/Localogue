import type { ReviewFieldComparison } from "@/domain/entities/review";

/**
 * 字段审核决策。
 *
 * keep_library：保留 Canonical Library 当前值；
 * use_evidence：采用本次 Evidence 的值。
 *
 * 对新作品而言没有旧值可保留，因此服务层会自动使用 Evidence。
 */
export type FieldReviewDecision = "keep_library" | "use_evidence";

/**
 * 实体审核决策。
 *
 * - use_match：使用 Entity Resolution 唯一命中的实体；
 * - bind_existing：人工从歧义候选中指定一个已有实体；
 * - create_new：创建新的 Canonical Entity；
 * - skip：本次不把该来源值写入关系。
 */
export type EntityReviewAction =
  | "use_match"
  | "bind_existing"
  | "create_new"
  | "skip";

export interface EntityReviewDecision {
  /** 与 UI 中的来源实体一一对应，例如 performer:星野みづき。 */
  key: string;
  action: EntityReviewAction;
  targetId?: string;
}

export interface ReviewDecisions {
  /** 已有作品发生字段差异时的字段级选择。 */
  fields: Partial<Record<ReviewFieldComparison["field"], FieldReviewDecision>>;
  /** 新实体、歧义实体和已有实体绑定的明确选择。 */
  entities: EntityReviewDecision[];
}

export type CommitOperationKind =
  | "create_person"
  | "create_organization"
  | "create_series"
  | "create_genre"
  | "create_tag"
  | "create_work"
  | "update_work";

export interface CommitOperation {
  kind: CommitOperationKind;
  entityId: string;
  label: string;
  detail: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Commit Plan 是“准备怎样修改 Canonical Library”的可读计划。
 *
 * 它本身不写文件。只有用户再次确认，并且服务器重新计算得到同一 fingerprint，
 * 才允许 Commit Executor 真正执行。
 */
export interface CanonicalCommitPlan {
  schemaVersion: 1;
  evidenceId: string;
  generatedAt: string;
  mode: "create" | "update";
  targetWorkId: string;
  targetWorkCode: string;
  operations: CommitOperation[];
  blockers: string[];
  warnings: string[];
  fingerprint: string;
}

/** 正式执行后的留痕记录。 */
export interface CanonicalCommitReceipt {
  schemaVersion: 1;
  id: string;
  evidenceId: string;
  committedAt: string;
  fingerprint: string;
  targetWorkId: string;
  targetWorkCode: string;
  operationCount: number;
}
