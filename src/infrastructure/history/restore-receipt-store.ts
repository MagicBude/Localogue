import { randomUUID } from "node:crypto";

import type { CanonicalRestoreReceipt } from "@/domain/entities/snapshot";
import { getConfiguredPrivateLibraryPath } from "@/infrastructure/repositories/library-path";
import { JsonFileStore } from "@/infrastructure/repositories/json-file-store";

function requirePrivateRoot(): string {
  const root = getConfiguredPrivateLibraryPath();
  if (!root) throw new Error("当前未配置私人资料库，不能读取恢复记录。");
  return root;
}

/** 先在内存中分配稳定 ID，让 Provenance 可以引用它；真正文件写入放在恢复流程最后。 */
export function createRestoreReceipt(
  input: Omit<CanonicalRestoreReceipt, "schemaVersion" | "id" | "restoredAt">,
): CanonicalRestoreReceipt {
  const restoredAt = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: `restore_${restoredAt.replace(/[:.]/g, "-")}_${randomUUID().slice(0, 8)}`,
    restoredAt,
    ...input,
  };
}

export async function saveRestoreReceipt(receipt: CanonicalRestoreReceipt): Promise<void> {
  await new JsonFileStore(requirePrivateRoot()).writeEntity("restore-receipts", receipt);
}

export async function listRestoreReceipts(): Promise<CanonicalRestoreReceipt[]> {
  if (!getConfiguredPrivateLibraryPath()) return [];
  const items = await new JsonFileStore(requirePrivateRoot()).readCollection<CanonicalRestoreReceipt>("restore-receipts");
  return items.sort((a, b) => b.restoredAt.localeCompare(a.restoredAt));
}

export async function findRestoreReceiptByCommitId(
  commitReceiptId: string,
): Promise<CanonicalRestoreReceipt | null> {
  const receipts = await listRestoreReceipts();
  return receipts.find((item) => item.commitReceiptId === commitReceiptId) ?? null;
}
