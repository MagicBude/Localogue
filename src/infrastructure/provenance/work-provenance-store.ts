import { randomUUID } from "node:crypto";

import type {
  FieldProvenanceEvent,
  WorkProvenanceLog,
} from "@/domain/entities/provenance";
import { getConfiguredPrivateLibraryPath } from "@/infrastructure/repositories/library-path";
import { JsonFileStore } from "@/infrastructure/repositories/json-file-store";

function requirePrivateRoot(): string {
  const root = getConfiguredPrivateLibraryPath();
  if (!root) throw new Error("当前未配置私人资料库，不能写入 Provenance。");
  return root;
}

export async function findWorkProvenanceLog(workId: string): Promise<WorkProvenanceLog | null> {
  const root = getConfiguredPrivateLibraryPath();
  if (!root) return null;
  const logs = await new JsonFileStore(root).readCollection<WorkProvenanceLog>("provenance");
  return logs.find((item) => item.workId === workId) ?? null;
}

export async function appendWorkProvenanceEvents(
  workId: string,
  events: Array<Omit<FieldProvenanceEvent, "schemaVersion" | "id" | "workId">>,
): Promise<FieldProvenanceEvent[]> {
  if (!events.length) return [];
  const root = requirePrivateRoot();
  const store = new JsonFileStore(root);
  const existing = await findWorkProvenanceLog(workId);
  const created = events.map((event) => ({
    schemaVersion: 1 as const,
    id: `prov_${randomUUID()}`,
    workId,
    ...event,
  }));
  const log: WorkProvenanceLog = {
    schemaVersion: 1,
    id: workId,
    workId,
    events: [...(existing?.events ?? []), ...created],
  };
  await store.writeEntity("provenance", log);
  return created;
}

export async function listLatestWorkFieldProvenance(
  workId: string,
): Promise<Map<FieldProvenanceEvent["field"], FieldProvenanceEvent>> {
  const log = await findWorkProvenanceLog(workId);
  const latest = new Map<FieldProvenanceEvent["field"], FieldProvenanceEvent>();
  for (const event of log?.events ?? []) latest.set(event.field, event);
  return latest;
}

export async function listProvenanceEventsByCommitId(commitId: string): Promise<FieldProvenanceEvent[]> {
  const root = getConfiguredPrivateLibraryPath();
  if (!root) return [];
  const logs = await new JsonFileStore(root).readCollection<WorkProvenanceLog>("provenance");
  return logs.flatMap((log) => log.events).filter((event) => event.commitId === commitId);
}
