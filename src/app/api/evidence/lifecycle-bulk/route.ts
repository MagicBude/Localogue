import { NextResponse } from "next/server";

import { getEvidenceLifecycle, setEvidenceLifecycle } from "@/infrastructure/evidence/evidence-lifecycle-store";
import { findEvidenceRecordById } from "@/infrastructure/evidence/evidence-store";

export async function POST(request: Request) {
  const body = (await request.json()) as { ids?: unknown; status?: unknown };
  if (!Array.isArray(body.ids) || !body.ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "ids must be a string array." }, { status: 400 });
  }
  if (body.status !== "pending" && body.status !== "ignored") {
    return NextResponse.json({ error: "Only pending/ignored bulk transitions are allowed." }, { status: 400 });
  }

  // 先确认每个 Evidence 都真实存在，再开始写 Lifecycle，避免输入 ID 错误时只更新一半。
  for (const id of body.ids) {
    if (!(await findEvidenceRecordById(id))) {
      return NextResponse.json({ error: `Evidence not found: ${id}` }, { status: 404 });
    }
  }

  const previous = await Promise.all(body.ids.map((id) => getEvidenceLifecycle(id)));
  if (previous.some((record) => record.status === "committed")) {
    return NextResponse.json(
      { error: "Committed Evidence must be restored through Commit History before changing lifecycle." },
      { status: 409 },
    );
  }

  const updated: string[] = [];
  try {
    // 顺序写入方便失败时知道已经改了哪些记录。V1 JSON 没有数据库事务，
    // 所以这里用 before-state 做补偿式恢复。
    for (const id of body.ids) {
      await setEvidenceLifecycle(id, body.status as "pending" | "ignored", {
        note: "V1-08 bulk curation",
      });
      updated.push(id);
    }
  } catch (error) {
    for (const record of previous.filter((item) => updated.includes(item.evidenceId))) {
      await setEvidenceLifecycle(record.evidenceId, record.status, {
        commitReceiptId: record.commitReceiptId,
        note: record.note,
      });
    }
    throw error;
  }

  return NextResponse.json({ updated: body.ids.length, status: body.status });
}
