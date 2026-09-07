import { NextResponse } from "next/server";

import {
  type PresentationEntityType,
  type PresentationPreference,
  normalizeRating,
} from "@/domain/entities/presentation-preference";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import {
  getPresentationPreference,
  makePresentationPreferenceId,
  savePresentationPreference,
} from "@/infrastructure/presentation/presentation-preference-store";

export const runtime = "nodejs";
const entityTypes = new Set<PresentationEntityType>(["person", "work"]);

/**
 * 读取某个实体的展示偏好。
 *
 * 返回 { preference }，找不到时为 { preference: null }。
 * 收藏按钮 / 评分组件在挂载时调用它来初始化自己的状态。
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ entityType: string; id: string }> },
) {
  try {
    const { entityType: rawType, id } = await context.params;
    const entityType = rawType as PresentationEntityType;
    if (!entityTypes.has(entityType)) throw new Error("不支持的展示偏好实体类型。");
    const preference = await getPresentationPreference(entityType, id);
    return NextResponse.json({ preference });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ entityType: string; id: string }> }) {
  try {
    const { entityType: rawType, id } = await context.params;
    const entityType = rawType as PresentationEntityType;
    if (!entityTypes.has(entityType)) throw new Error("不支持的展示偏好实体类型。");
    const body = (await request.json()) as {
      assetId?: string | null;
      favorite?: boolean | null;
      rating?: number | null;
    };
    const assetId = body.assetId?.trim() || undefined;

    if (assetId) await assertAssetCanBeUsed(entityType, id, assetId);
    else await assertEntity(entityType, id);

    const previous = await getPresentationPreference(entityType, id);
    const preference: PresentationPreference = {
      schemaVersion: 1,
      id: makePresentationPreferenceId(entityType, id),
      entityType,
      entityId: id,
      ...(previous ?? {}),
      ...(entityType === "person"
        ? { preferredPortraitAssetId: assetId }
        : { preferredCoverAssetId: assetId }),
      ...(typeof body.favorite === "boolean" ? { favorite: body.favorite } : {}),
      // rating 为 null 表示“清除评分”，不写入；否则用 normalizeRating 收敛到 1–5 整数。
      ...(body.rating === null ? {} : typeof body.rating === "number" ? { rating: normalizeRating(body.rating) } : {}),
      updatedAt: new Date().toISOString(),
    };
    // JSON.stringify 会忽略 undefined，因此“恢复默认”不会把空值硬写进文件。
    await savePresentationPreference(preference);
    return NextResponse.json({ preference });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

async function assertEntity(type: PresentationEntityType, id: string) {
  const entity = type === "person"
    ? await libraryRepository.findPersonById(id)
    : await libraryRepository.findWorkById(id);
  if (!entity) throw new Error(`找不到 ${type} ${id}。`);
}

async function assertAssetCanBeUsed(type: PresentationEntityType, entityId: string, assetId: string) {
  const asset = await libraryRepository.findAssetById(assetId);
  if (!asset) throw new Error(`找不到 Asset ${assetId}。`);

  if (type === "person") {
    if (!["portrait", "gallery"].includes(asset.type)) {
      throw new Error("人物展示头像只能选择 portrait / gallery 图片。");
    }
    const person = await libraryRepository.findPersonById(entityId);
    if (!person) throw new Error(`找不到 person ${entityId}。`);
    const canonicalIds = new Set([person.portraitAssetId, ...person.galleryAssetIds].filter(Boolean));
    const ownedLocally = asset.subjectType === "person" && asset.subjectId === entityId;
    if (!ownedLocally && !canonicalIds.has(asset.id)) {
      throw new Error("该 Asset 没有归属于当前人物，不能作为其展示头像。");
    }
    return;
  }

  if (!["poster", "cover", "gallery", "fanart", "screenshot"].includes(asset.type)) {
    throw new Error("作品显示首图只能选择 poster / cover / gallery / fanart / screenshot 图片。");
  }
  const work = await libraryRepository.findWorkById(entityId);
  if (!work) throw new Error(`找不到 work ${entityId}。`);
  const ownedLocally = asset.subjectType === "work" && asset.subjectId === entityId;
  if (!ownedLocally && !work.assetIds.includes(asset.id)) {
    throw new Error("该 Asset 没有归属于当前作品，不能作为其显示首图。");
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
