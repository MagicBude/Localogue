import { randomUUID } from "node:crypto";
import type { EvidenceRecord, ImportPreview } from "@/domain/entities/evidence";
import { JsonFileStore } from "@/infrastructure/repositories/json-file-store";
import { getPrivateRuntimeLibraryPath } from "@/infrastructure/repositories/library-path";

/**
 * Evidence 永远属于私人运行数据。
 *
 * - 配置私人 Library 后：跟随该 Library；
 * - 尚未配置时：暂存在 Git 忽略的 data/library。
 *
 * Shared Pack 永远只读，因此 Evidence 不会写入 Pack。
 */
export async function savePreviewAsEvidence(preview: ImportPreview): Promise<EvidenceRecord[]> {
  const timestamp = new Date();
  const importedAt = timestamp.toISOString();
  const batchToken = timestamp.toISOString().replace(/[:.]/g, "-");

  const records = preview.candidates.map((candidate) => ({
    schemaVersion: 1 as const,
    id: `evidence_${batchToken}_${String(candidate.index).padStart(4, "0")}_${randomUUID().slice(0, 8)}`,
    sourceType: preview.sourceType,
    sourceName: preview.sourceName,
    importedAt,
    raw: candidate.raw,
    normalized: candidate.normalized,
    warnings: [...preview.warnings, ...candidate.warnings],
  }));

  const store = new JsonFileStore(getPrivateRuntimeLibraryPath());
  await Promise.all(records.map((record) => store.writeEntity("evidence", record)));
  return records;
}

/**
 * Evidence Inbox 读取的是“私人资料目录”中的证据，而不是公开 Demo Library。
 *
 * 这两个读取源在默认开发模式下故意不同：
 * - Canonical Library：data/demo-library
 * - Evidence Inbox：data/library/evidence
 */
export async function listEvidenceRecords(): Promise<EvidenceRecord[]> {
  const records = await new JsonFileStore(getPrivateRuntimeLibraryPath()).readCollection<EvidenceRecord>("evidence");
  return records.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function findEvidenceRecordById(id: string): Promise<EvidenceRecord | null> {
  const records = await listEvidenceRecords();
  return records.find((record) => record.id === id) ?? null;
}
