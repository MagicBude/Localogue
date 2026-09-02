import { NextResponse } from "next/server";

import { scanConfiguredMedia } from "@/application/media/media-scan-service";
import { isPrivateLibraryConfigured, libraryRepository } from "@/infrastructure/repositories/repository-provider";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isPrivateLibraryConfigured()) throw new Error("请先在设置页配置 Private Library，再建立本地 MediaFile。 ");
    const body = await request.json().catch(() => ({})) as {
      computeSha256?: boolean;
      probeMedia?: boolean;
      pruneMissing?: boolean;
    };
    return NextResponse.json(await scanConfiguredMedia(libraryRepository, body));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
