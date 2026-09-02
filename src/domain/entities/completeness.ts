/**
 * 资料完整度只衡量“元数据是否丰富、结构是否完整”，不等同于资料真伪或数据质量。
 *
 * 例如：一条错误但字段齐全的记录可能拿到高分，所以 Completeness 只能作为治理队列的
 * 一个信号，不能替代 Evidence、Provenance 与人工 Review。
 */
export type CompletenessLevel =
  | "complete"
  | "good"
  | "needs_attention"
  | "incomplete";

export interface CompletenessCheck {
  id: string;
  weight: number;
  passed: boolean;
}

export interface CompletenessResult {
  score: number;
  level: CompletenessLevel;
  checks: CompletenessCheck[];
  missingIds: string[];
}
