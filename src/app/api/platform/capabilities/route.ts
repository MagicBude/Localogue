import { NextResponse } from "next/server";

import { nodeWebPlatform } from "@/infrastructure/platform/node-platform-provider";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(nodeWebPlatform.capabilities);
}
