"use client";

import { useFavorites } from "@/components/favorites-provider";
import type { UiDictionary } from "@/i18n/ui";

interface FavoriteButtonProps {
  workId: string;
  dictionary: UiDictionary;
  /** card：悬浮在海报右上角的小心形；detail：详情页带文字的按钮。 */
  variant?: "card" | "detail";
}

/**
 * 收藏切换按钮。
 *
 * 收藏状态来自 FavoritesProvider（全局内存镜像），因此这里只负责渲染与触发切换，
 * 真正的读写在 Provider 的 toggleFavorite 里通过 API 完成。组件保持“无状态、纯展示 + 事件”。
 */
export function FavoriteButton({ workId, dictionary, variant = "card" }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(workId);

  function handleClick(event: React.MouseEvent) {
    // 卡片形态下按钮浮在海报链接上方，避免触发跳转。
    event.preventDefault();
    event.stopPropagation();
    void toggleFavorite(workId);
  }

  const label = active ? dictionary.unfavorite : dictionary.favorite;

  if (variant === "detail") {
    return (
      <button
        className={`favorite-button favorite-button--detail${active ? " is-active" : ""}`}
        onClick={handleClick}
        type="button"
        aria-pressed={active}
        title={label}
      >
        <HeartIcon filled={active} />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      className={`favorite-button favorite-button--card${active ? " is-active" : ""}`}
      onClick={handleClick}
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      <HeartIcon filled={active} />
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      height="18"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="18"
    >
      <path d="M12 21s-7.5-4.6-10-9.3C.5 8.4 2 5 5.2 5c2 0 3.3 1.2 4.1 2.4C10.1 6.2 11.4 5 13.4 5 16.6 5 18 8.4 16.4 11.7 14 16.4 12 21 12 21z" />
    </svg>
  );
}
