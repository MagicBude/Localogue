import type { MouseEvent } from "react";

import { useDesktopI18n } from "./desktop-i18n";
import { useFavorites } from "./desktop-favorites-provider";

export type FavoriteButtonVariant = "card" | "detail" | "inline";

/**
 * 桌面端收藏按钮，复用 Web 的三形态思路：
 * - card：海报墙卡片右上角浮层（绝对定位，不嵌套进卡片按钮内部）。
 * - inline：列表 / 表格行的紧凑图标按钮。
 * - detail：详情页带文字的按钮。
 *
 * 状态与乐观更新都来自 useFavorites；点击只切私人展示偏好，不触碰 Canonical Work。
 */
export function DesktopFavoriteButton({
  workId,
  variant = "card",
}: {
  workId: string;
  variant?: FavoriteButtonVariant;
}) {
  const { t } = useDesktopI18n();
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(workId);

  function handleClick(event: MouseEvent<HTMLButtonElement>): void {
    // 防止触发外层卡片 / 行的打开动作。
    event.stopPropagation();
    toggleFavorite(workId);
  }

  return (
    <button
      type="button"
      className={`favorite-button favorite-button--${variant}${active ? " is-active" : ""}`}
      aria-pressed={active}
      title={active ? t("取消收藏") : t("收藏")}
      onClick={handleClick}
    >
      <span className="favorite-button__icon" aria-hidden="true">♥</span>
      {variant === "detail" ? <span>{active ? t("取消收藏") : t("收藏")}</span> : null}
    </button>
  );
}
