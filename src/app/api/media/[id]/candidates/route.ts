import { NextResponse } from "next/server";

import { listMediaBindingCandidates } from "@/application/media/media-binding-service";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const q = new URL(request.url).searchParams.get("q") ?? undefined;
    return NextResponse.json({ candidates: await listMediaBindingCandidates(libraryRepository, id, q) });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
