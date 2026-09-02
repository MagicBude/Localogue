import { NextResponse } from "next/server";

import { importPortablePack, previewPortablePack } from "@/application/packs/portable-pack-service";

export const runtime = "nodejs";
const MAX_UPLOAD = 256 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const action = String(form.get("action") ?? "preview");
    if (!(file instanceof File)) throw new Error("请选择 .localogue-pack 文件。");
    if (file.size > MAX_UPLOAD) return NextResponse.json({ error: "V1-11 Pack 暂时限制为 256 MB。" }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (action === "preview") return NextResponse.json({ preview: await previewPortablePack(bytes) });
    if (action === "import") return NextResponse.json({ result: await importPortablePack(bytes) });
    throw new Error("action 必须为 preview 或 import。");
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
