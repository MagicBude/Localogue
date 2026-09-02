import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";

import { resolveAssetContent } from "@/infrastructure/assets/asset-content-resolver";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const resolved = await resolveAssetContent(id);
  if (!resolved) return new NextResponse("Asset not found", { status: 404 });
  if (resolved.kind === "redirect") return NextResponse.redirect(new URL(resolved.url, _request.url));

  const bytes = await readFile(resolved.absolutePath);
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);
  return new NextResponse(body, {
    headers: {
      "content-type": resolved.asset.mimeType ?? "application/octet-stream",
      "content-length": String(bytes.byteLength),
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
