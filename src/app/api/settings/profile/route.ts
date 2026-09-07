import { NextResponse } from "next/server";

import {
  createProfile,
  deleteProfile,
  renameProfile,
  seedDemoLibrary,
  switchProfile,
} from "@/application/settings/settings-service";

export const runtime = "nodejs";

interface ProfileActionBody {
  action?: string;
  id?: string;
  name?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProfileActionBody;
    const action = body.action;

    switch (action) {
      case "switch": {
        if (!body.id) return NextResponse.json({ error: "缺少 id。" }, { status: 400 });
        return NextResponse.json(switchProfile(body.id));
      }
      case "create": {
        return NextResponse.json(createProfile(body.name));
      }
      case "rename": {
        if (!body.id || !body.name) return NextResponse.json({ error: "缺少 id 或 name。" }, { status: 400 });
        return NextResponse.json(renameProfile(body.id, body.name));
      }
      case "remove": {
        if (!body.id) return NextResponse.json({ error: "缺少 id。" }, { status: 400 });
        return NextResponse.json(deleteProfile(body.id));
      }
      case "seed-demo": {
        return NextResponse.json(await seedDemoLibrary());
      }
      default:
        return NextResponse.json({ error: "未知的 profile action。" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
