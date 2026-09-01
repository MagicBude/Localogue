import { randomUUID } from "node:crypto";

import type {
  CanonicalCommitPlan,
  CanonicalCommitReceipt,
} from "@/domain/entities/commit-plan";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import type { BuiltCommitPlan } from "@/application/review/commit-plan-service";
import { saveCommitReceipt } from "@/infrastructure/evidence/review-commit-store";

/**
 * 文件版“提交执行器”。
 *
 * V1 JSON 无法像 SQLite 一样提供真正的跨文件事务，因此写入顺序采用：
 * 新依赖实体 → Work → Commit Receipt。
 * 这样即使中途失败，最多留下暂未引用的孤立实体，不会先写出引用不存在实体的 Work。
 */
export async function executeCanonicalCommit(
  built: BuiltCommitPlan,
  library: LibraryRepository,
): Promise<CanonicalCommitReceipt> {
  const { plan, writes } = built;
  if (plan.blockers.length) {
    throw new Error(`Commit Plan 仍有阻塞项：${plan.blockers.join("；")}`);
  }

  for (const person of writes.people) await library.savePerson(person);
  for (const organization of writes.organizations) await library.saveOrganization(organization);
  for (const series of writes.series) await library.saveSeries(series);
  for (const genre of writes.genres) await library.saveGenre(genre);
  for (const tag of writes.tags) await library.saveTag(tag);

  // Work 最后写入，避免它引用尚未落盘的新实体。
  // 如果 Plan 没有 create_work / update_work，则只记录“该 Evidence 已审核归档”，
  // 不为了留痕而无意义地改写 Work.updatedAt。
  const shouldWriteWork = plan.operations.some((operation) =>
    operation.kind === "create_work" || operation.kind === "update_work",
  );
  if (shouldWriteWork) {
    writes.work.updatedAt = new Date().toISOString();
    await library.saveWork(writes.work);
  }

  const receipt: CanonicalCommitReceipt = {
    schemaVersion: 1,
    id: `commit_${new Date().toISOString().replace(/[:.]/g, "-")}_${randomUUID().slice(0, 8)}`,
    evidenceId: plan.evidenceId,
    committedAt: new Date().toISOString(),
    fingerprint: plan.fingerprint,
    targetWorkId: plan.targetWorkId,
    targetWorkCode: plan.targetWorkCode,
    operationCount: plan.operations.length,
  };
  await saveCommitReceipt(receipt);
  return receipt;
}

export function summarizeCommitPlan(plan: CanonicalCommitPlan): string {
  return `${plan.mode === "create" ? "创建" : "更新"} ${plan.targetWorkCode}，共 ${plan.operations.length} 个操作`;
}
