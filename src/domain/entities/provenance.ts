import type { EvidenceSourceType } from "@/domain/entities/evidence";
import type { ReviewFieldComparison } from "@/domain/entities/review";

/**
 * Provenance 追踪的是“某个 Canonical 字段为什么成为当前值”。
 *
 * V1-07 先以 Work 字段为粒度记录。事件只追加、不覆盖，因此既能找到
 * 当前来源，也能回顾这个字段过去曾经采用过哪些 Evidence。
 */
export type ProvenanceField = ReviewFieldComparison["field"];

export type ProvenanceEventType = "adopted" | "restored";

export interface FieldProvenanceEvent {
  schemaVersion: 1;
  id: string;
  workId: string;
  field: ProvenanceField;
  eventType: ProvenanceEventType;
  /** adopted 事件来自哪条 Evidence；restore 事件没有新的 Evidence。 */
  evidenceId?: string;
  sourceType?: EvidenceSourceType;
  sourceName?: string;
  commitId?: string;
  restoreReceiptId?: string;
  recordedAt: string;
  /** 记录事件发生后该字段的 Canonical 值，便于审计和教学。 */
  value: unknown;
}

export interface WorkProvenanceLog {
  schemaVersion: 1;
  id: string;
  workId: string;
  events: FieldProvenanceEvent[];
}
