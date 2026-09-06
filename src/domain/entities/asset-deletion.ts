import type { Asset } from "./asset";

/**
 * Private Asset 回收站记录。
 *
 * 删除动作会移除 Asset JSON 与主体引用，但管理图片文件仍保留。Receipt 保存恢复所需的
 * 最小 before-image；它独立于 Canonical Asset，避免把工作流状态混进资源事实。
 */
export interface AssetDeletionReceipt {
  schemaVersion: 1;
  id: string;
  asset: Asset;
  subjectType: "work" | "person";
  subjectId: string;
  workAssetLinked?: boolean;
  personPortraitLinked?: boolean;
  personGalleryLinked?: boolean;
  state: "pending" | "deleted" | "restored" | "failed";
  deletedAt: string;
  updatedAt: string;
  restoredAt?: string;
  error?: string;
}
