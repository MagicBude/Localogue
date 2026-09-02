import { NextResponse } from "next/server";

import { restoreCommit } from "@/application/history/restore-service";
import { findCommitReceiptById } from "@/infrastructure/evidence/review-commit-store";
import { isPrivateLibraryConfigured, libraryRepository } from "@/infrastructure/repositories/repository-provider";

interface RestoreRequestBody { commitReceiptId?: string }

export async function POST(request: Request) {
  if (!isPrivateLibraryConfigured()) {
    return NextResponse.json({ error: "当前处于只读 Demo 模式，不能恢复 Canonical Snapshot。" }, { status: 409 });
  }

  const body = (await request.json()) as RestoreRequestBody;
  if (!body.commitReceiptId) {
    return NextResponse.json({ error: "缺少 commitReceiptId。" }, { status: 400 });
  }

  const commit = await findCommitReceiptById(body.commitReceiptId);
  if (!commit) return NextResponse.json({ error: "Commit Receipt 不存在。" }, { status: 404 });

  try {
    const receipt = await restoreCommit(commit, libraryRepository);
    return NextResponse.json({ receipt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Snapshot 恢复失败。" },
      { status: 409 },
    );
  }
}
