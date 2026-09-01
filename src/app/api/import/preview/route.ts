import { NextResponse } from "next/server";

import { previewImport } from "@/infrastructure/importers/importer-registry";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择要导入的文件。" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "V1-04 单个导入文件暂时限制为 10 MB。" }, { status: 413 });
    }

    const preview = await previewImport({
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });

    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入预览失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
