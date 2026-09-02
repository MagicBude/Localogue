import { NextResponse } from "next/server";

import { updateMediaBinding } from "@/application/media/media-binding-service";
import { isPrivateLibraryConfigured, libraryRepository } from "@/infrastructure/repositories/repository-provider";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isPrivateLibraryConfigured()) throw new Error("请先配置 Private Library。");
    const { id } = await context.params;
    const body = await request.json() as { workId?: string | null };
    const result = await updateMediaBinding(libraryRepository, id, body.workId ?? null);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
