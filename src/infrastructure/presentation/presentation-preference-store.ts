import type { PresentationEntityType, PresentationPreference } from "@/domain/entities/presentation-preference";
import { JsonFileStore } from "@/infrastructure/repositories/json-file-store";
import { getConfiguredPrivateLibraryPath } from "@/infrastructure/repositories/library-path";

/**
 * Presentation Preference 属于用户私人层，永远不写入 Shared Pack。
 *
 * 这里复用 JsonFileStore：一个实体一份 JSON，后续迁移 SQLite 时只需要替换存储实现。
 */
export async function getPresentationPreference(
  entityType: PresentationEntityType,
  entityId: string,
): Promise<PresentationPreference | null> {
  const root = getConfiguredPrivateLibraryPath();
  if (!root) return null;
  const store = new JsonFileStore(root);
  const items = await store.readCollection<PresentationPreference>("presentation-preferences");
  return items.find((item) => item.entityType === entityType && item.entityId === entityId) ?? null;
}

export async function savePresentationPreference(
  preference: PresentationPreference,
): Promise<void> {
  const root = getConfiguredPrivateLibraryPath();
  if (!root) throw new Error("请先在设置中配置可写的 Private Library。");
  await new JsonFileStore(root).writeEntity("presentation-preferences", preference);
}

export function makePresentationPreferenceId(
  entityType: PresentationEntityType,
  entityId: string,
): string {
  return `presentation_${entityType}_${entityId}`;
}
