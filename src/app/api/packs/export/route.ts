import { NextResponse } from "next/server";

import { exportPersonalPack, exportSharedPack } from "@/application/packs/portable-pack-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const kind = params.get("kind");
    const result = kind === "personal"
      ? await exportPersonalPack()
      : kind === "shared"
        ? await exportSharedPack(params.get("path") ?? "")
        : null;
    if (!result) return NextResponse.json({ error: "kind 必须为 personal 或 shared。" }, { status: 400 });

    // Portable Pack Service 返回 Uint8Array，运行时本身可以作为二进制响应体。
    // 但在新版 TypeScript + DOM 类型中，Uint8Array<ArrayBufferLike> 并不总能
    // 直接赋值给 BodyInit。这里显式复制成标准 ArrayBuffer，既保持二进制内容
    // 完全一致，也避免使用 any / 类型断言掩盖 Node.js 与 DOM 类型定义差异。
    const responseBody = new ArrayBuffer(result.bytes.byteLength);
    new Uint8Array(responseBody).set(result.bytes);

    return new NextResponse(responseBody, {
      headers: {
        "content-type": "application/vnd.localogue.pack",
        "content-disposition": `attachment; filename="${result.fileName}"`,
        "content-length": String(result.bytes.byteLength),
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
