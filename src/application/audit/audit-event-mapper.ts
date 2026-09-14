import type { AssetDeletionReceipt } from "@/domain/entities/asset-deletion";
import type { CanonicalCommitReceipt } from "@/domain/entities/commit-plan";
import type { EvidenceLifecycleRecord, EvidenceRecord } from "@/domain/entities/evidence";
import type { MediaBindingReceipt } from "@/domain/entities/media-binding";
import type { MediaScanHistoryEntry } from "@/domain/entities/media-scan-history";
import type { CanonicalRestoreReceipt } from "@/domain/entities/snapshot";
import type { AuditEvent } from "@/domain/entities/audit-event";

/** 将一个原始审计记录投影为统一事件；没有完整记录时宁可返回 null，也不猜测主体。 */
export function mapAuditRecordToEvent(collection: string, record: unknown): AuditEvent | null {
  if (!isRecord(record) || typeof record.id !== "string") return null;
  switch (collection) {
    case "evidence": {
      const item = record as unknown as EvidenceRecord;
      return event(item.id, "evidence_imported", "evidence", item.id, item.importedAt, item.sourceType === "connector" ? "connector" : "system", collection, "导入来源资料", item.id);
    }
    case "evidence-lifecycle": {
      const item = record as unknown as EvidenceLifecycleRecord;
      return event(item.id, "evidence_lifecycle_changed", "evidence", item.evidenceId, item.updatedAt, "user", collection, `资料状态：${item.status}`, item.id);
    }
    case "review-commits": {
      const item = record as unknown as CanonicalCommitReceipt;
      return event(item.id, "evidence_committed", "work", item.targetWorkId, item.committedAt, "user", collection, `采用资料：${item.targetWorkCode}`, item.id);
    }
    case "restore-receipts": {
      const item = record as unknown as CanonicalRestoreReceipt;
      return event(item.id, "restore_completed", "work", item.targetWorkId, item.restoredAt, "user", collection, `恢复作品：${item.targetWorkCode}`, item.id);
    }
    case "media-binding-receipts": {
      const item = record as unknown as MediaBindingReceipt;
      return event(item.id, "media_bound", "media", item.mediaFileId, item.changedAt, "user", collection, `媒体${item.action}`, item.id);
    }
    case "asset-deletion-receipts": {
      const item = record as unknown as AssetDeletionReceipt;
      return event(item.id, "asset_deleted", "asset", item.asset.id, item.updatedAt, "user", collection, `图片${item.state}`, item.id);
    }
    case "media-scan-history": {
      const item = record as unknown as MediaScanHistoryEntry;
      return event(item.id, "scan_completed", "library", undefined, item.recordedAt, "system", collection, "完成一次媒体扫描", item.id);
    }
    case "provenance": {
      const item = record as { id: string; workId?: string; events?: Array<{ recordedAt?: string }> };
      const occurredAt = item.events?.at(-1)?.recordedAt;
      return occurredAt ? event(item.id, "provenance_changed", "work", item.workId, occurredAt, "system", collection, "作品来源发生变化", item.id) : null;
    }
    default:
      return null;
  }
}

export function mapAuditRecordsToEvents(collection: string, records: readonly unknown[]): AuditEvent[] {
  return records.map((record) => mapAuditRecordToEvent(collection, record)).filter((item): item is AuditEvent => item !== null);
}

function event(id: string, eventType: AuditEvent["eventType"], subjectType: AuditEvent["subjectType"], subjectId: string | undefined, occurredAt: string, actor: AuditEvent["actor"], sourceCollection: string, summary: string, payloadRef: string): AuditEvent {
  return { schemaVersion: 1, id: `${sourceCollection}:${id}`, eventType, subjectType, subjectId, occurredAt, actor, sourceCollection, summary, payloadRef };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
