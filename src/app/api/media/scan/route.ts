import { NextResponse } from "next/server";

import { mediaScanCoordinator, startConfiguredMediaScan } from "@/infrastructure/media/media-scan-runtime";
import { isPrivateLibraryConfigured } from "@/infrastructure/repositories/repository-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ job: mediaScanCoordinator.getSnapshot() });
}

export async function POST(request: Request) {
  try {
    if (!isPrivateLibraryConfigured()) throw new Error("请先在设置页配置 Private Library，再建立本地 MediaFile。 ");
    const body = await request.json().catch(() => ({})) as {
      computeSha256?: boolean;
      probeMedia?: boolean;
      pruneMissing?: boolean;
    };
    const job = startConfiguredMediaScan(body);
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: message(error), job: mediaScanCoordinator.getSnapshot() }, { status: 400 });
  }
}

export async function DELETE() {
  const job = mediaScanCoordinator.cancel();
  return NextResponse.json({ job });
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
