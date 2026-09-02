import type {
  EvidenceLifecycleRecord,
  EvidenceLifecycleStatus,
} from "@/domain/entities/evidence-lifecycle";
import { getConfiguredPrivateLibraryPath } from "@/infrastructure/repositories/library-path";
import { JsonFileStore } from "@/infrastructure/repositories/json-file-store";

function resolveLifecycleRoot(): string {
  return getConfiguredPrivateLibraryPath() ?? `${process.cwd()}/data/library`;
}

const store = new JsonFileStore(resolveLifecycleRoot());

export async function getEvidenceLifecycle(
  evidenceId: string,
): Promise<EvidenceLifecycleRecord> {
  const all = await store.readCollection<EvidenceLifecycleRecord>("evidence-lifecycle");
  return all.find((item) => item.evidenceId === evidenceId) ?? {
    schemaVersion: 1,
    id: evidenceId,
    evidenceId,
    status: "pending",
    updatedAt: new Date(0).toISOString(),
  };
}

export async function listEvidenceLifecycles(): Promise<EvidenceLifecycleRecord[]> {
  return store.readCollection<EvidenceLifecycleRecord>("evidence-lifecycle");
}

export async function setEvidenceLifecycle(
  evidenceId: string,
  status: EvidenceLifecycleStatus,
  options: { commitReceiptId?: string; note?: string } = {},
): Promise<EvidenceLifecycleRecord> {
  const record: EvidenceLifecycleRecord = {
    schemaVersion: 1,
    id: evidenceId,
    evidenceId,
    status,
    updatedAt: new Date().toISOString(),
    ...options,
  };
  await store.writeEntity("evidence-lifecycle", record);
  return record;
}
