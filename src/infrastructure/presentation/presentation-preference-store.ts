import type { PresentationEntityType, PresentationPreference } from "@/domain/entities/presentation-preference";
import { JsonFileStore } from "@/infrastructure/repositories/json-file-store";
import { getPrivateRuntimeLibraryPath } from "@/infrastructure/repositories/library-path";

/**
 * Presentation Preference 属于用户私人层，永远不写入 Shared Pack。
 *
 * 这里复用 JsonFileStore：一个实体一份 JSON，后续迁移 SQLite 时只需要替换存储实现。
 *
 * 写入根使用 getPrivateRuntimeLibraryPath()：
 * - 已配置 Private Library 时，落到该库（与阅读/封面偏好同一处）；
 * - 未配置时回退到 Git 忽略的 data/library，使收藏/评分在 demo 模式下也可本地保存，
 *   且绝不触碰只读的 data/demo-library。
 */
const COLLECTION = "presentation-preferences";

export async function getPresentationPreference(
  entityType: PresentationEntityType,
  entityId: string,
): Promise<PresentationPreference | null> {
  const root = getPrivateRuntimeLibraryPath();
  const store = new JsonFileStore(root);
  const items = await store.readCollection<PresentationPreference>(COLLECTION);
  return items.find((item) => item.entityType === entityType && item.entityId === entityId) ?? null;
}

export async function savePresentationPreference(
  preference: PresentationPreference,
): Promise<void> {
  const root = getPrivateRuntimeLibraryPath();
  await new JsonFileStore(root).writeEntity(COLLECTION, preference);
}

/**
 * 返回当前所有被收藏的作品 ID。
 *
 * 用于“收藏”页与全局收藏计数。只认 favorite === true，
 * 因此取消收藏（favorite: false）或尚未评分的记录不会出现在结果里。
 */
export async function listFavoriteWorkIds(): Promise<string[]> {
  const root = getPrivateRuntimeLibraryPath();
  const store = new JsonFileStore(root);
  const items = await store.readCollection<PresentationPreference>(COLLECTION);
  return items
    .filter((item) => item.entityType === "work" && item.favorite === true)
    .map((item) => item.entityId);
}

export function makePresentationPreferenceId(
  entityType: PresentationEntityType,
  entityId: string,
): string {
  return `presentation_${entityType}_${entityId}`;
}
