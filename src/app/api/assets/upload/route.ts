import { NextResponse } from "next/server";

import type { AssetSubjectType, AssetType } from "@/domain/entities/asset";
import { uploadPrivateAsset } from "@/application/assets/asset-upload-service";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";

export const runtime = "nodejs";

const subjectTypes = new Set<AssetSubjectType>(["person", "work"]);
const assetTypes = new Set<AssetType>(["cover", "poster", "fanart", "screenshot", "portrait", "gallery", "logo", "subtitle", "document", "other"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const subjectType = String(form.get("subjectType") ?? "") as AssetSubjectType;
    const subjectId = String(form.get("subjectId") ?? "").trim();
    const type = String(form.get("type") ?? "") as AssetType;

    if (!(file instanceof File)) throw new Error("请选择要上传的图片文件。");
    if (!subjectTypes.has(subjectType)) throw new Error("subjectType 不合法。");
    if (!subjectId) throw new Error("subjectId 不能为空。");
    if (!assetTypes.has(type)) throw new Error("Asset type 不合法。");

    const asset = await uploadPrivateAsset({
      repository: libraryRepository,
      subjectType,
      subjectId,
      type,
      fileName: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return NextResponse.json({ asset });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
