import { NextResponse } from "next/server";

import type { ImportPreview } from "@/domain/entities/evidence";
import { savePreviewAsEvidence } from "@/infrastructure/evidence/evidence-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const preview = (await request.json()) as ImportPreview;
    if (!preview?.sourceType || !Array.isArray(preview.candidates)) {
      return NextResponse.json({ error: "Evidence 数据格式不正确。" }, { status: 400 });
    }

    const records = await savePreviewAsEvidence(preview);
    return NextResponse.json({
      saved: records.length,
      ids: records.map((record) => record.id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存 Evidence 失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
