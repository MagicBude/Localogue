import { NextResponse } from "next/server";

import { listFavoriteWorkIds } from "@/infrastructure/presentation/presentation-preference-store";

export const runtime = "nodejs";

/**
 * 返回当前所有被收藏的作品 ID 列表。
 *
 * 客户端 FavoritesProvider 在挂载时调用一次，用于全局收藏计数与卡片高亮，
 * 避免每张卡片各自请求自己的收藏状态。结果只含 work 类型且 favorite === true 的实体。
 */
export async function GET() {
  try {
    const ids = await listFavoriteWorkIds();
    return NextResponse.json({ ids });
  } catch (error) {
    return NextResponse.json({ error: message(error), ids: [] }, { status: 400 });
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
