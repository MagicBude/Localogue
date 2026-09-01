import { randomUUID } from "node:crypto";
import path from "node:path";

import type { EvidenceRecord, ImportPreview } from "@/domain/entities/evidence";
import { JsonFileStore } from "@/infrastructure/repositories/json-file-store";

/**
 * 导入写入路径与 Demo 浏览路径刻意分开。
 *
 * - 浏览若未配置环境变量，仍读取 data/demo-library；
 * - 导入若未配置环境变量，则写到被 Git 忽略的 data/library。
 *
 * 这样第一次尝试导入时不会意外修改仓库里的 Demo 数据。
 */
function resolveWritableLibraryRoot(): string {
  const configured = process.env.LOCALOGUE_LIBRARY_PATH?.trim();
  return configured
    ? path.resolve(/* turbopackIgnore: true */ process.cwd(), configured)
    : path.join(process.cwd(), "data", "library");
}

const store = new JsonFileStore(resolveWritableLibraryRoot());

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

  await Promise.all(records.map((record) => store.writeEntity("evidence", record)));
  return records;
}
