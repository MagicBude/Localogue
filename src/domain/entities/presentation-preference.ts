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
  /**
   * 用户是否把该作品标记为收藏。
   * 属于“我想怎样看”的私人展示偏好，不修改 Canonical Work，也不进入 Shared Pack。
   */
  favorite?: boolean;
  /**
   * 用户个人评分，整数 1–5。
   * 同样属于私人展示偏好；评分不会影响任何公共元数据或排序算法之外的展示。
   */
  rating?: number;
  updatedAt: string;
}

/** 评分合法取值：1–5 的整数。 */
export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** 把任意输入收敛到合法评分值；非数字或越界返回 undefined（即“未评分”）。 */
export function normalizeRating(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  if (rounded < RATING_MIN || rounded > RATING_MAX) return undefined;
  return rounded;
}
