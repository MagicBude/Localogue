import { analyzeEvidenceRecords, analyzeSingleEvidenceRecord } from "@/application/review/entity-resolution-service";
import { buildCanonicalCommitPlan, type BuiltCommitPlan } from "@/application/review/commit-plan-service";
import { createDefaultReviewDecisions } from "@/application/review/review-decision-service";
import { buildAdoptedProvenanceEvents, buildRestoredProvenanceEvents } from "@/application/provenance/work-provenance-service";
import { buildCurationOverview } from "@/application/curation/curation-service";
import type { CanonicalCommitPlan, CanonicalCommitReceipt, ReviewDecisions } from "@/domain/entities/commit-plan";
import type { EvidenceRecord } from "@/domain/entities/evidence";
import type { EvidenceLifecycleRecord, EvidenceLifecycleStatus } from "@/domain/entities/evidence-lifecycle";
import type { FieldProvenanceEvent, WorkProvenanceLog } from "@/domain/entities/provenance";
import type { EvidenceReviewAnalysis } from "@/domain/entities/review";
import type { CanonicalRestoreReceipt, CanonicalSnapshot, SnapshotEntry } from "@/domain/entities/snapshot";
import type { Work } from "@/domain/entities/work";

import { desktopBridge } from "./tauri-bridge";
import type { DesktopLibraryCollection, DesktopPrivateAuditCollection } from "./contracts";
import { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { desktopVocabularyRepository } from "./desktop-vocabulary-repository";

export interface DesktopEvidenceRow {
  evidence: EvidenceRecord;
  lifecycle: EvidenceLifecycleRecord;
  analysis: EvidenceReviewAnalysis;
}

export interface DesktopGovernanceInbox {
  rows: DesktopEvidenceRow[];
  counts: Record<EvidenceLifecycleStatus | "all", number>;
}

const operationCollection: Partial<Record<CanonicalCommitPlan["operations"][number]["kind"], string>> = {
  create_person: "people",
  create_organization: "organizations",
  create_series: "series",
  create_genre: "genres",
  create_tag: "tags",
  create_work: "works",
  update_work: "works",
};

export async function loadDesktopGovernanceInbox(
  repository: TauriLibraryRepository,
): Promise<DesktopGovernanceInbox> {
  const [evidence, lifecycles, commits] = await Promise.all([
    desktopBridge.readPrivateAuditCollection<EvidenceRecord>("evidence"),
    desktopBridge.readPrivateAuditCollection<EvidenceLifecycleRecord>("evidence-lifecycle"),
    desktopBridge.readPrivateAuditCollection<CanonicalCommitReceipt>("review-commits"),
  ]);
  const lifecycleMap = new Map(lifecycles.map((item) => [item.evidenceId, item]));
  const committed = new Map(commits.map((item) => [item.evidenceId, item]));
  const ordered = [...evidence].sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  const analyses = await analyzeEvidenceRecords(ordered, repository, desktopVocabularyRepository);
  const rows = ordered.map((item, index) => {
    const receipt = committed.get(item.id);
    const lifecycle = lifecycleMap.get(item.id) ?? {
      schemaVersion: 1 as const,
      id: item.id,
      evidenceId: item.id,
      status: receipt ? "committed" as const : "pending" as const,
      updatedAt: receipt?.committedAt ?? new Date(0).toISOString(),
      ...(receipt ? { commitReceiptId: receipt.id } : {}),
    };
    return { evidence: item, lifecycle, analysis: analyses[index]! };
  });
  return {
    rows,
    counts: {
      all: rows.length,
      pending: rows.filter((row) => row.lifecycle.status === "pending").length,
      committed: rows.filter((row) => row.lifecycle.status === "committed").length,
      ignored: rows.filter((row) => row.lifecycle.status === "ignored").length,
    },
  };
}

export async function setDesktopEvidenceLifecycle(
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
  await desktopBridge.writePrivateAuditEntity("evidence-lifecycle", record);
  return record;
}

export async function prepareDesktopReview(
  evidence: EvidenceRecord,
  repository: TauriLibraryRepository,
): Promise<{ analysis: EvidenceReviewAnalysis; decisions: ReviewDecisions; built: BuiltCommitPlan }> {
  const analysis = await analyzeSingleEvidenceRecord(evidence, repository, desktopVocabularyRepository);
  const decisions = createDefaultReviewDecisions(analysis);
  const built = await buildCanonicalCommitPlan(evidence, analysis, decisions, repository, true);
  return { analysis, decisions, built };
}

export async function rebuildDesktopCommitPlan(
  evidence: EvidenceRecord,
  analysis: EvidenceReviewAnalysis,
  decisions: ReviewDecisions,
  repository: TauriLibraryRepository,
): Promise<BuiltCommitPlan> {
  return buildCanonicalCommitPlan(evidence, analysis, decisions, repository, true);
}

export async function executeDesktopCanonicalCommit(
  built: BuiltCommitPlan,
  evidence: EvidenceRecord,
  repository: TauriLibraryRepository,
  privateLibraryPath: string,
): Promise<CanonicalCommitReceipt> {
  if (built.plan.blockers.length) {
    throw new Error(`Commit Plan 仍有阻塞项：${built.plan.blockers.join("；")}`);
  }
  const committedAt = new Date().toISOString();
  const receiptId = `commit_${safeTimestamp(committedAt)}_${crypto.randomUUID().slice(0, 8)}`;
  const snapshot = await createDesktopSnapshot(built.plan, privateLibraryPath);
  await desktopBridge.writePrivateAuditEntity("snapshots", snapshot);

  try {
    for (const person of built.writes.people) await repository.savePerson(person);
    for (const organization of built.writes.organizations) await repository.saveOrganization(organization);
    for (const series of built.writes.series) await repository.saveSeries(series);
    for (const genre of built.writes.genres) await repository.saveGenre(genre);
    for (const tag of built.writes.tags) await repository.saveTag(tag);

    const shouldWriteWork = built.plan.operations.some((operation) => operation.kind === "create_work" || operation.kind === "update_work");
    if (shouldWriteWork) {
      built.writes.work.updatedAt = committedAt;
      await repository.saveWork(built.writes.work);
    }

    await appendDesktopProvenance(
      built.plan.targetWorkId,
      buildAdoptedProvenanceEvents(evidence, built.plan, receiptId),
    );
    await setDesktopEvidenceLifecycle(evidence.id, "committed", { commitReceiptId: receiptId });

    const receipt: CanonicalCommitReceipt = {
      schemaVersion: 2,
      id: receiptId,
      evidenceId: built.plan.evidenceId,
      committedAt,
      fingerprint: built.plan.fingerprint,
      targetWorkId: built.plan.targetWorkId,
      targetWorkCode: built.plan.targetWorkCode,
      operationCount: built.plan.operations.length,
      operations: built.plan.operations,
      snapshotId: snapshot.id,
    };
    await desktopBridge.writePrivateAuditEntity("review-commits", receipt);
    return receipt;
  } catch (error) {
    try {
      await desktopBridge.restorePrivateSnapshot(snapshot, true);
    } catch (restoreError) {
      throw new Error(`Canonical Commit 失败且自动恢复也失败：${message(error)}；恢复错误：${message(restoreError)}`);
    }
    throw new Error(`Canonical Commit 失败，已自动恢复 Snapshot：${message(error)}`);
  }
}

export async function loadDesktopHistory() {
  const [commits, snapshots, restores] = await Promise.all([
    desktopBridge.readPrivateAuditCollection<CanonicalCommitReceipt>("review-commits"),
    desktopBridge.readPrivateAuditCollection<CanonicalSnapshot>("snapshots"),
    desktopBridge.readPrivateAuditCollection<CanonicalRestoreReceipt>("restore-receipts"),
  ]);
  return {
    commits: [...commits].sort((a, b) => b.committedAt.localeCompare(a.committedAt)),
    snapshots,
    restores: [...restores].sort((a, b) => b.restoredAt.localeCompare(a.restoredAt)),
  };
}

export async function restoreDesktopCommit(
  commit: CanonicalCommitReceipt,
  repository: TauriLibraryRepository,
): Promise<CanonicalRestoreReceipt> {
  const { commits, snapshots, restores } = await loadDesktopHistory();
  if (!commit.snapshotId) throw new Error("该 Commit 没有 Snapshot，不能恢复。");
  if (restores.some((item) => item.commitReceiptId === commit.id)) throw new Error("该 Commit 已经恢复过。\n");
  const restoredIds = new Set(restores.map((item) => item.commitReceiptId));
  const latestActive = commits.find((item) => item.targetWorkId === commit.targetWorkId && !restoredIds.has(item.id));
  if (latestActive?.id !== commit.id) throw new Error("该作品之后还有更新的 Commit，只允许恢复最新活动 Commit。");
  const snapshot = snapshots.find((item) => item.id === commit.snapshotId);
  if (!snapshot) throw new Error("找不到该 Commit 对应的 Snapshot。");

  const blockers = await findDesktopReferenceBlockers(snapshot, commit.targetWorkId, repository);
  if (blockers.length) throw new Error(`当前 Commit 不能恢复：${blockers.join("；")}`);

  const guard = await captureDesktopGuard(snapshot, repository);
  const restoredAt = new Date().toISOString();
  const receipt: CanonicalRestoreReceipt = {
    schemaVersion: 1,
    id: `restore_${safeTimestamp(restoredAt)}_${crypto.randomUUID().slice(0, 8)}`,
    commitReceiptId: commit.id,
    snapshotId: snapshot.id,
    targetWorkId: commit.targetWorkId,
    targetWorkCode: commit.targetWorkCode,
    restoredAt,
    restoredEntryCount: snapshot.entries.length,
  };

  try {
    await desktopBridge.restorePrivateSnapshot(snapshot, false);
    await setDesktopEvidenceLifecycle(commit.evidenceId, "pending");
    const restoredWork = await repository.findWorkById(commit.targetWorkId);
    await appendDesktopProvenance(
      commit.targetWorkId,
      buildRestoredProvenanceEvents(commit, receipt.id, restoredWork),
    );
    await desktopBridge.writePrivateAuditEntity("restore-receipts", receipt);
    return receipt;
  } catch (error) {
    try { await desktopBridge.restorePrivateSnapshot(guard, true); }
    catch (guardError) { throw new Error(`Restore 失败且 guard 回滚也失败：${message(error)}；guard：${message(guardError)}`); }
    throw new Error(`Restore 失败，已回到操作前状态：${message(error)}`);
  }
}

export { buildCurationOverview };

async function createDesktopSnapshot(plan: CanonicalCommitPlan, privateRoot: string): Promise<CanonicalSnapshot> {
  const relativePaths = new Set<string>();
  for (const operation of plan.operations) {
    const collection = operationCollection[operation.kind];
    if (collection) relativePaths.add(`${collection}/${operation.entityId}.json`);
  }
  relativePaths.add(`provenance/${plan.targetWorkId}.json`);
  relativePaths.add(`evidence-lifecycle/${plan.evidenceId}.json`);
  const entries = await readSnapshotEntries([...relativePaths].sort(), privateRoot);
  const createdAt = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: `snapshot_${safeTimestamp(createdAt)}_${crypto.randomUUID().slice(0, 8)}`,
    createdAt,
    evidenceId: plan.evidenceId,
    targetWorkId: plan.targetWorkId,
    targetWorkCode: plan.targetWorkCode,
    fingerprint: plan.fingerprint,
    entries,
  };
}

async function captureDesktopGuard(source: CanonicalSnapshot, repository: TauriLibraryRepository): Promise<CanonicalSnapshot> {
  const entries: SnapshotEntry[] = [];
  const canonicalCache = new Map<string, Array<{ id: string } & Record<string, unknown>>>();
  const auditCache = new Map<string, Array<{ id: string } & Record<string, unknown>>>();
  for (const entry of source.entries) {
    const [collection, file] = entry.relativePath.split("/");
    const id = file?.replace(/\.json$/, "");
    if (!collection || !id) continue;
    const isAudit = collection === "provenance" || collection === "evidence-lifecycle";
    const cache = isAudit ? auditCache : canonicalCache;
    let rows = cache.get(collection);
    if (!rows) {
      rows = isAudit
        ? await desktopBridge.readPrivateAuditCollection(collection as DesktopPrivateAuditCollection)
        : await repository.readPrivateCollection<Record<string, unknown> & { id: string }>(collection as DesktopLibraryCollection);
      cache.set(collection, rows);
    }
    const current = rows.find((item) => item.id === id);
    entries.push({ relativePath: entry.relativePath, existed: Boolean(current), ...(current ? { content: `${JSON.stringify(current, null, 2)}\n` } : {}) });
  }
  return { ...source, id: `restore_guard_${crypto.randomUUID().slice(0, 8)}`, createdAt: new Date().toISOString(), entries };
}

async function readSnapshotEntries(relativePaths: string[], privateRoot: string): Promise<SnapshotEntry[]> {
  const canonicalCache = new Map<string, Array<{ id: string } & Record<string, unknown>>>();
  const auditCache = new Map<string, Array<{ id: string } & Record<string, unknown>>>();
  const entries: SnapshotEntry[] = [];
  for (const relativePath of relativePaths) {
    const [collection, file] = relativePath.split("/");
    const id = file?.replace(/\.json$/, "");
    if (!collection || !id) throw new Error(`Snapshot 路径无效：${relativePath}`);
    const isAudit = collection === "provenance" || collection === "evidence-lifecycle";
    const cache = isAudit ? auditCache : canonicalCache;
    let rows = cache.get(collection);
    if (!rows) {
      rows = isAudit
        ? await desktopBridge.readPrivateAuditCollection<Record<string, unknown> & { id: string }>(collection as DesktopPrivateAuditCollection)
        : await desktopBridge.readLibraryCollection<Record<string, unknown> & { id: string }>(privateRoot, collection as DesktopLibraryCollection);
      cache.set(collection, rows);
    }
    const current = rows.find((item) => item.id === id);
    entries.push({ relativePath, existed: Boolean(current), ...(current ? { content: `${JSON.stringify(current, null, 2)}\n` } : {}) });
  }
  return entries;
}

async function appendDesktopProvenance(
  workId: string,
  events: Array<Omit<FieldProvenanceEvent, "schemaVersion" | "id" | "workId">>,
): Promise<void> {
  if (!events.length) return;
  const logs = await desktopBridge.readPrivateAuditCollection<WorkProvenanceLog>("provenance");
  const existing = logs.find((item) => item.workId === workId);
  const created = events.map((event) => ({
    schemaVersion: 1 as const,
    id: `prov_${crypto.randomUUID()}`,
    workId,
    ...event,
  }));
  const log: WorkProvenanceLog = {
    schemaVersion: 1,
    id: workId,
    workId,
    events: [...(existing?.events ?? []), ...created],
  };
  await desktopBridge.writePrivateAuditEntity("provenance", log);
}

async function findDesktopReferenceBlockers(
  snapshot: CanonicalSnapshot,
  targetWorkId: string,
  repository: TauriLibraryRepository,
): Promise<string[]> {
  const created = snapshot.entries
    .filter((entry) => !entry.existed)
    .map((entry) => /^(people|organizations|series|genres|tags|works)\/([^/]+)\.json$/.exec(entry.relativePath))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({ collection: match[1]!, id: match[2]! }));
  if (!created.length) return [];
  const works = (await repository.listWorks({ page: 1, pageSize: 100_000 })).items.filter((work) => work.id !== targetWorkId);
  const blockers: string[] = [];
  for (const entity of created) {
    const referenced = works.filter((work) => workReferences(work, entity.collection, entity.id));
    if (referenced.length) blockers.push(`${entity.collection}/${entity.id} 已被其他作品引用：${referenced.map((work) => work.code).join("、")}`);
  }
  return blockers;
}

function workReferences(work: Work, collection: string, id: string): boolean {
  switch (collection) {
    case "people": return work.personRelations.some((item) => item.personId === id);
    case "organizations": return work.makerId === id || work.labelId === id;
    case "series": return work.seriesIds.includes(id);
    case "genres": return work.genreIds.includes(id);
    case "tags": return work.tagIds.includes(id);
    default: return false;
  }
}

function safeTimestamp(value: string): string { return value.replace(/[:.]/g, "-"); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
