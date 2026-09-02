import { NextResponse } from "next/server";

import type { EvidenceLifecycleStatus } from "@/domain/entities/evidence-lifecycle";
import { findEvidenceRecordById } from "@/infrastructure/evidence/evidence-store";
import { getEvidenceLifecycle, setEvidenceLifecycle } from "@/infrastructure/evidence/evidence-lifecycle-store";

interface LifecycleRequestBody {
  evidenceId?: string;
  status?: "pending" | "ignored";
}

export async function POST(request: Request) {
  const body = (await request.json()) as LifecycleRequestBody;
  if (!body.evidenceId || !body.status) {
    return NextResponse.json({ error: "缺少 evidenceId 或 status。" }, { status: 400 });
  }
  if (!["pending", "ignored"].includes(body.status)) {
    return NextResponse.json({ error: "生命周期 API 只允许人工切换 pending / ignored。" }, { status: 400 });
  }
  const evidence = await findEvidenceRecordById(body.evidenceId);
  if (!evidence) return NextResponse.json({ error: "Evidence 不存在。" }, { status: 404 });

  const current = await getEvidenceLifecycle(evidence.id);
  if (current.status === "committed") {
    return NextResponse.json({ error: "已归档 Evidence 不能直接改为 ignored；如需撤销请使用 Commit History 的 Snapshot 恢复。" }, { status: 409 });
  }
  const record = await setEvidenceLifecycle(evidence.id, body.status as EvidenceLifecycleStatus);
  return NextResponse.json({ lifecycle: record });
}
