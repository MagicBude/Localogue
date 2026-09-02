
import type { CanonicalCommitReceipt } from "@/domain/entities/commit-plan";
import { listRestoreReceipts } from "@/infrastructure/history/restore-receipt-store";
import { JsonFileStore } from "@/infrastructure/repositories/json-file-store";
import { getPrivateRuntimeLibraryPath } from "@/infrastructure/repositories/library-path";

function receiptStore(): JsonFileStore {
  return new JsonFileStore(getPrivateRuntimeLibraryPath());
}


export async function saveCommitReceipt(receipt: CanonicalCommitReceipt): Promise<void> {
  await receiptStore().writeEntity("review-commits", receipt);
}

export async function listCommitReceipts(): Promise<CanonicalCommitReceipt[]> {
  const items = await receiptStore().readCollection<CanonicalCommitReceipt>("review-commits");
  return items.sort((a, b) => b.committedAt.localeCompare(a.committedAt));
}

export async function findCommitReceiptById(id: string): Promise<CanonicalCommitReceipt | null> {
  const receipts = await listCommitReceipts();
  return receipts.find((item) => item.id === id) ?? null;
}

export async function findLatestCommitReceiptByEvidenceId(
  evidenceId: string,
): Promise<CanonicalCommitReceipt | null> {
  const receipts = await listCommitReceipts();
  return receipts.find((item) => item.evidenceId === evidenceId) ?? null;
}


export async function findLatestActiveCommitReceiptByEvidenceId(
  evidenceId: string,
): Promise<CanonicalCommitReceipt | null> {
  const [receipts, restores] = await Promise.all([listCommitReceipts(), listRestoreReceipts()]);
  const restoredIds = new Set(restores.map((item) => item.commitReceiptId));
  return receipts.find((item) => item.evidenceId === evidenceId && !restoredIds.has(item.id)) ?? null;
}


export async function findLatestActiveCommitReceiptByWorkId(
  workId: string,
): Promise<CanonicalCommitReceipt | null> {
  const [receipts, restores] = await Promise.all([listCommitReceipts(), listRestoreReceipts()]);
  const restoredIds = new Set(restores.map((item) => item.commitReceiptId));
  return receipts.find((item) => item.targetWorkId === workId && !restoredIds.has(item.id)) ?? null;
}

export async function findLatestCommitReceiptByWorkId(
  workId: string,
): Promise<CanonicalCommitReceipt | null> {
  const receipts = await listCommitReceipts();
  return receipts.find((item) => item.targetWorkId === workId) ?? null;
}
