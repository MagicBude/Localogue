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
    // PUT 在这里采用“局部更新”语义。必须区分两种情况：
    // 1. 请求没有 assetId：收藏或评分组件只想改自己的字段，应保留既有首图；
    // 2. 请求明确传 assetId: null：展示偏好页要恢复默认首图，应删除既有选择。
    // 如果只用 `body.assetId?.trim()`，这两种情况都会变成 undefined，随后一次收藏操作
    // 就可能顺带清掉封面偏好。这也是为什么要检查属性是否真的存在于请求对象上。
    const updatesAsset = Object.prototype.hasOwnProperty.call(body, "assetId");
    const updatesRating = Object.prototype.hasOwnProperty.call(body, "rating");
    const assetId = typeof body.assetId === "string" ? body.assetId.trim() || undefined : undefined;

    if (updatesAsset && assetId) await assertAssetCanBeUsed(entityType, id, assetId);
    else await assertEntity(entityType, id);

    const previous = await getPresentationPreference(entityType, id);
    const preference: PresentationPreference = {
      schemaVersion: 1,
      id: makePresentationPreferenceId(entityType, id),
      entityType,
      entityId: id,
      ...(previous ?? {}),
      ...(updatesAsset
        ? entityType === "person"
          ? { preferredPortraitAssetId: assetId }
          : { preferredCoverAssetId: assetId }
        : {}),
      ...(typeof body.favorite === "boolean" ? { favorite: body.favorite } : {}),
      // 明确传 null 时用 undefined 覆盖旧值；JSON 序列化会省略该字段，从而真正清除评分。
      ...(updatesRating
        ? { rating: typeof body.rating === "number" ? normalizeRating(body.rating) : undefined }
        : {}),
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
