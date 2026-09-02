export type DuplicateCandidateKind = "work" | "person";
export type DuplicateConfidence = "high" | "medium" | "low";

/**
 * DuplicateCandidate 只是“值得人工看一眼”的候选关系，不代表系统已经确认重复。
 *
 * V1-08 明确禁止自动 merge。真正的合并需要未来单独的 Merge Plan、引用迁移和审计记录。
 */
export interface DuplicateCandidate {
  id: string;
  kind: DuplicateCandidateKind;
  leftId: string;
  rightId: string;
  confidence: DuplicateConfidence;
  reasonIds: string[];
}
