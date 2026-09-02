/**
 * Evidence 本体保持不可变；“待审核 / 已归档 / 已忽略”属于生命周期状态，
 * 单独存储可以避免为了改状态而重写原始证据。
 */
export type EvidenceLifecycleStatus = "pending" | "committed" | "ignored";

export interface EvidenceLifecycleRecord {
  schemaVersion: 1;
  id: string;
  evidenceId: string;
  status: EvidenceLifecycleStatus;
  updatedAt: string;
  commitReceiptId?: string;
  note?: string;
}
