/**
 * 审计事件是跨 Receipt 类型的只读展示模型。
 *
 * 它不是新的写入真相：恢复、审核和补偿仍依赖原始 Receipt。这个轻量模型只负责让
 * 历史页按时间、对象和动作展示不同集合中的记录，SQLite 与 JSON Adapter 可以共用。
 */
export type AuditEventType =
  | "evidence_imported"
  | "evidence_lifecycle_changed"
  | "evidence_committed"
  | "person_edited"
  | "media_bound"
  | "asset_deleted"
  | "scan_completed"
  | "snapshot_created"
  | "restore_completed"
  | "provenance_changed";

export type AuditSubjectType = "work" | "person" | "media" | "asset" | "evidence" | "library" | "system";

export interface AuditEvent {
  schemaVersion: 1;
  id: string;
  eventType: AuditEventType;
  subjectType: AuditSubjectType;
  subjectId?: string;
  occurredAt: string;
  actor: "user" | "system" | "connector";
  sourceCollection: string;
  summary: string;
  /** 原始 Receipt 的稳定 ID，避免把完整 before-image 复制进事件视图。 */
  payloadRef: string;
}
