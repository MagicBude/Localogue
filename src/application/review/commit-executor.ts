import { randomUUID } from "node:crypto";

import type {
  CanonicalCommitPlan,
  CanonicalCommitReceipt,
} from "@/domain/entities/commit-plan";
import type { EvidenceRecord } from "@/domain/entities/evidence";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import type { BuiltCommitPlan } from "@/application/review/commit-plan-service";
import { buildAdoptedProvenanceEvents } from "@/application/provenance/work-provenance-service";
import { setEvidenceLifecycle } from "@/infrastructure/evidence/evidence-lifecycle-store";
import { saveCommitReceipt } from "@/infrastructure/evidence/review-commit-store";
import {
  createCanonicalSnapshot,
  restoreCanonicalSnapshot,
} from "@/infrastructure/history/canonical-snapshot-store";
import { appendWorkProvenanceEvents } from "@/infrastructure/provenance/work-provenance-store";

/**
 * 文件版“提交执行器”。
 *
 * V1-07 在 V1-06 的安全写入顺序上再增加两层：
 * 1. 写入前创建最小 Canonical Snapshot（before-image）；
 * 2. 任意一步失败时自动尝试恢复 Snapshot。
 *
 * 它依然不等于 SQLite Transaction，但已经能非常直观地展示
 * “先记录旧状态 → 执行变更 → 成功留痕 / 失败回滚”的事务思想。
 */
export async function executeCanonicalCommit(
  built: BuiltCommitPlan,
  evidence: EvidenceRecord,
  library: LibraryRepository,
): Promise<CanonicalCommitReceipt> {
  const { plan, writes } = built;
  if (plan.blockers.length) {
    throw new Error(`Commit Plan 仍有阻塞项：${plan.blockers.join("；")}`);
  }

  const committedAt = new Date().toISOString();
  const receiptId = `commit_${committedAt.replace(/[:.]/g, "-")}_${randomUUID().slice(0, 8)}`;
  const snapshot = await createCanonicalSnapshot(plan);

  try {
    for (const person of writes.people) await library.savePerson(person);
    for (const organization of writes.organizations) await library.saveOrganization(organization);
    for (const series of writes.series) await library.saveSeries(series);
    for (const genre of writes.genres) await library.saveGenre(genre);
    for (const tag of writes.tags) await library.saveTag(tag);

    // Work 最后写入，避免它引用尚未落盘的新实体。
    const shouldWriteWork = plan.operations.some((operation) =>
      operation.kind === "create_work" || operation.kind === "update_work",
    );
    if (shouldWriteWork) {
      writes.work.updatedAt = committedAt;
      await library.saveWork(writes.work);
    }

    const provenanceEvents = buildAdoptedProvenanceEvents(evidence, plan, receiptId);
    await appendWorkProvenanceEvents(plan.targetWorkId, provenanceEvents);

    // 生命周期在 Receipt 之前写；若这里或 Receipt 失败，Snapshot 会把它恢复到提交前状态。
    await setEvidenceLifecycle(evidence.id, "committed", { commitReceiptId: receiptId });

    const receipt: CanonicalCommitReceipt = {
      schemaVersion: 2,
      id: receiptId,
      evidenceId: plan.evidenceId,
      committedAt,
      fingerprint: plan.fingerprint,
      targetWorkId: plan.targetWorkId,
      targetWorkCode: plan.targetWorkCode,
      operationCount: plan.operations.length,
      operations: plan.operations,
      snapshotId: snapshot.id,
    };
    await saveCommitReceipt(receipt);
    return receipt;
  } catch (error) {
    try {
      await restoreCanonicalSnapshot(snapshot, { includeAuditState: true });
    } catch (restoreError) {
      const original = error instanceof Error ? error.message : String(error);
      const rollback = restoreError instanceof Error ? restoreError.message : String(restoreError);
      throw new Error(`Canonical Commit 失败，并且自动恢复 Snapshot 也失败。原始错误：${original}；恢复错误：${rollback}`);
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Canonical Commit 失败，已自动恢复到提交前 Snapshot。原因：${reason}`);
  }
}

export function summarizeCommitPlan(plan: CanonicalCommitPlan): string {
  return `${plan.mode === "create" ? "创建" : "更新"} ${plan.targetWorkCode}，共 ${plan.operations.length} 个操作`;
}
