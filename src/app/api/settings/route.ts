import { NextResponse } from "next/server";

import { getSettingsOverview, updateInstanceSettings } from "@/application/settings/settings-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(getSettingsOverview());
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    return NextResponse.json(await updateInstanceSettings(await request.json()));
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
