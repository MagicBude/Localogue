import type { CanonicalCommitReceipt } from "@/domain/entities/commit-plan";
import type { CanonicalRestoreReceipt, CanonicalSnapshot } from "@/domain/entities/snapshot";
import type { Work } from "@/domain/entities/work";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import { buildRestoredProvenanceEvents } from "@/application/provenance/work-provenance-service";
import { setEvidenceLifecycle } from "@/infrastructure/evidence/evidence-lifecycle-store";
import {
  findLatestActiveCommitReceiptByWorkId,
} from "@/infrastructure/evidence/review-commit-store";
import {
  captureCurrentStateForSnapshot,
  findCanonicalSnapshotById,
  restoreCanonicalSnapshot,
} from "@/infrastructure/history/canonical-snapshot-store";
import {
  createRestoreReceipt,
  findRestoreReceiptByCommitId,
  saveRestoreReceipt,
} from "@/infrastructure/history/restore-receipt-store";
import { appendWorkProvenanceEvents } from "@/infrastructure/provenance/work-provenance-store";

export interface RestoreEligibility {
  allowed: boolean;
  blockers: string[];
  snapshot: CanonicalSnapshot | null;
}

/**
 * 恢复不是“随便选一个旧版本覆盖”。
 *
 * V1-07 只允许恢复某 Work 的最新 Commit，并检查本次 Commit 创建的新实体
 * 是否已经被其他 Work 引用。这样旧 Snapshot 不会悄悄破坏之后形成的新关系。
 */
export async function checkRestoreEligibility(
  commit: CanonicalCommitReceipt,
  library: LibraryRepository,
): Promise<RestoreEligibility> {
  const blockers: string[] = [];
  if (!commit.snapshotId) {
    return { allowed: false, blockers: ["这条历史提交创建于 V1-07 之前，没有可恢复 Snapshot。"], snapshot: null };
  }

  const [snapshot, previousRestore, latestCommit] = await Promise.all([
    findCanonicalSnapshotById(commit.snapshotId),
    findRestoreReceiptByCommitId(commit.id),
    findLatestActiveCommitReceiptByWorkId(commit.targetWorkId),
  ]);
  if (!snapshot) blockers.push("找不到该 Commit 对应的 Snapshot。可能已被手工删除。\n");
  if (previousRestore) blockers.push("这条 Commit 已经执行过恢复，不能重复恢复。\n");
  if (latestCommit?.id !== commit.id) {
    blockers.push("该作品之后还有更新的 Commit。必须先处理最新提交，不能直接恢复较旧版本。\n");
  }

  if (snapshot) {
    const referenceBlockers = await findReferenceBlockers(snapshot, commit.targetWorkId, library);
    blockers.push(...referenceBlockers);
  }

  return { allowed: blockers.length === 0, blockers: blockers.map((item) => item.trim()), snapshot };
}

export async function restoreCommit(
  commit: CanonicalCommitReceipt,
  library: LibraryRepository,
): Promise<CanonicalRestoreReceipt> {
  const eligibility = await checkRestoreEligibility(commit, library);
  if (!eligibility.allowed || !eligibility.snapshot) {
    throw new Error(`当前 Commit 不能恢复：${eligibility.blockers.join("；")}`);
  }

  // 在真正恢复前抓取“当前状态 guard”。如果后续 lifecycle / provenance / receipt
  // 任一步失败，就尽量回到点击恢复按钮之前，避免恢复操作本身产生半状态。
  const guard = await captureCurrentStateForSnapshot(eligibility.snapshot);
  const restoreReceipt = createRestoreReceipt({
    commitReceiptId: commit.id,
    snapshotId: eligibility.snapshot.id,
    targetWorkId: commit.targetWorkId,
    targetWorkCode: commit.targetWorkCode,
    restoredEntryCount: eligibility.snapshot.entries.length,
  });

  try {
    await restoreCanonicalSnapshot(eligibility.snapshot);

    // Snapshot 已把 Evidence 生命周期恢复到 Commit 前状态；显式写回 pending，
    // 既表达业务含义，也兼容旧 Snapshot 中尚未包含 lifecycle 文件的情况。
    await setEvidenceLifecycle(commit.evidenceId, "pending");

    const restoredWork = await library.findWorkById(commit.targetWorkId);
    const events = buildRestoredProvenanceEvents(commit, restoreReceipt.id, restoredWork);
    await appendWorkProvenanceEvents(commit.targetWorkId, events);

    // Receipt 最后落盘：只有 Canonical、Lifecycle、Provenance 都完成后，
    // 历史系统才宣告这次 Restore 成功。
    await saveRestoreReceipt(restoreReceipt);
    return restoreReceipt;
  } catch (error) {
    try {
      await restoreCanonicalSnapshot(guard, { includeAuditState: true });
    } catch (guardError) {
      const original = error instanceof Error ? error.message : String(error);
      const rollback = guardError instanceof Error ? guardError.message : String(guardError);
      throw new Error(`Snapshot Restore 失败，并且恢复前状态 guard 也恢复失败。原始错误：${original}；guard 错误：${rollback}`);
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Snapshot Restore 失败，已恢复到点击恢复前的状态。原因：${reason}`);
  }
}

async function findReferenceBlockers(
  snapshot: CanonicalSnapshot,
  targetWorkId: string,
  library: LibraryRepository,
): Promise<string[]> {
  const newlyCreated = snapshot.entries
    .filter((entry) => !entry.existed)
    .map((entry) => parseEntityPath(entry.relativePath))
    .filter((item): item is { collection: string; entityId: string } => item !== null);
  if (!newlyCreated.length) return [];

  const works = (await library.listWorks({ pageSize: 100000 })).items;
  const otherWorks = works.filter((work) => work.id !== targetWorkId);
  const blockers: string[] = [];

  for (const entity of newlyCreated) {
    const referencedBy = otherWorks.filter((work) => workReferences(work, entity.collection, entity.entityId));
    if (referencedBy.length) {
      blockers.push(
        `本次 Commit 创建的 ${entity.collection}/${entity.entityId} 已被其他作品引用：${referencedBy.map((work) => work.code).join("、")}。`,
      );
    }
  }
  return blockers;
}

function parseEntityPath(relativePath: string): { collection: string; entityId: string } | null {
  const match = /^(people|organizations|series|genres|tags|works)\/([^/]+)\.json$/.exec(relativePath);
  return match ? { collection: match[1], entityId: match[2] } : null;
}

function workReferences(work: Work, collection: string, id: string): boolean {
  switch (collection) {
    case "people": return work.personRelations.some((item) => item.personId === id);
    case "organizations": return work.makerId === id || work.labelId === id;
    case "series": return work.seriesIds.includes(id);
    case "genres": return work.genreIds.includes(id);
    case "tags": return work.tagIds.includes(id);
    case "works": return false;
    default: return false;
  }
}
