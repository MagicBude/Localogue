import path from "node:path";

import type { CanonicalCommitReceipt } from "@/domain/entities/commit-plan";
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

export async function findLatestCommitReceiptByEvidenceId(
  evidenceId: string,
): Promise<CanonicalCommitReceipt | null> {
  const receipts = await listCommitReceipts();
  return receipts.find((item) => item.evidenceId === evidenceId) ?? null;
}
