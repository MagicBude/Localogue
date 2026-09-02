import path from "node:path";

import type { CanonicalCommitReceipt } from "@/domain/entities/commit-plan";
import { listRestoreReceipts } from "@/infrastructure/history/restore-receipt-store";
import { JsonFileStore } from "@/infrastructure/repositories/json-file-store";

function resolveReceiptRoot(): string {
  const configured = process.env.LOCALOGUE_LIBRARY_PATH?.trim();
  return configured
    ? path.resolve(/* turbopackIgnore: true */ process.cwd(), configured)
    : path.join(process.cwd(), "data", "library");
}

const store = new JsonFileStore(resolveReceiptRoot());

export async function saveCommitReceipt(receipt: CanonicalCommitReceipt): Promise<void> {
  await store.writeEntity("review-commits", receipt);
}

export async function listCommitReceipts(): Promise<CanonicalCommitReceipt[]> {
  const items = await store.readCollection<CanonicalCommitReceipt>("review-commits");
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
