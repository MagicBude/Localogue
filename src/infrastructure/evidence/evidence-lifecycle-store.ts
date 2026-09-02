import type {
  EvidenceLifecycleRecord,
  EvidenceLifecycleStatus,
} from "@/domain/entities/evidence-lifecycle";
import { getPrivateRuntimeLibraryPath } from "@/infrastructure/repositories/library-path";
import { JsonFileStore } from "@/infrastructure/repositories/json-file-store";

function resolveLifecycleRoot(): string {
  return getPrivateRuntimeLibraryPath();
}

function lifecycleStore(): JsonFileStore {
  return new JsonFileStore(resolveLifecycleRoot());
}

export async function getEvidenceLifecycle(
  evidenceId: string,
): Promise<EvidenceLifecycleRecord> {
  const all = await lifecycleStore().readCollection<EvidenceLifecycleRecord>("evidence-lifecycle");
  return all.find((item) => item.evidenceId === evidenceId) ?? {
    schemaVersion: 1,
    id: evidenceId,
    evidenceId,
    status: "pending",
    updatedAt: new Date(0).toISOString(),
  };
}

export async function listEvidenceLifecycles(): Promise<EvidenceLifecycleRecord[]> {
  return lifecycleStore().readCollection<EvidenceLifecycleRecord>("evidence-lifecycle");
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
  await lifecycleStore().writeEntity("evidence-lifecycle", record);
  return record;
}
