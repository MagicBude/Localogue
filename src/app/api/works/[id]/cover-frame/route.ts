import { NextResponse } from "next/server";

import { generateWorkCoverFrame } from "@/application/media/media-frame-service";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";

export const runtime = "nodejs";

/**
 * 从作品本地视频抽帧生成封面。
 *
 * 这是服务端能力（需 ffmpeg 与可访问的本地媒体文件），因此使用 nodejs runtime。
 * 失败以结构化 JSON 返回（422），由前端友好提示，而不是抛 500。
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const work = await libraryRepository.findWorkById(id);
    if (!work) {
      return NextResponse.json({ ok: false, reason: "no-media", message: "找不到该作品。" }, { status: 404 });
    }

    const result = await generateWorkCoverFrame(libraryRepository, id);
    if (!result.ok) {
      return NextResponse.json(result, { status: 422 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: "extract-failed", message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
