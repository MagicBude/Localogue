export type PresentationEntityType = "person" | "work";

/**
 * PresentationPreference 是“我想怎样显示”的私人偏好，不是公共事实。
 *
 * 例如 Community Pack 默认头像是 A，用户喜欢 B：
 * 只保存 preferredPortraitAssetId=B，不修改 Community Person。
 */
export interface PresentationPreference {
  schemaVersion: 1;
  id: string;
  entityType: PresentationEntityType;
  entityId: string;
  preferredPortraitAssetId?: string;
  preferredCoverAssetId?: string;
  updatedAt: string;
}
