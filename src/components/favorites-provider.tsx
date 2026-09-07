"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * 收藏状态的全局客户端来源。
 *
 * 为什么不放在每个卡片里各自请求？
 * 一张作品墙可能有几十张卡片，如果每张都去查自己的收藏状态，既慢又浪费。
 * 这里在挂载时只调用一次 GET /api/presentation/favorites 拿到全部收藏 ID，
 * 之后所有卡片都从内存里的 Set 读取，切换收藏时做乐观更新并回写 API。
 *
 * 这符合项目“展示偏好属于私人层”的原则：收藏只存在浏览器会话 + 私人资料库，
 * 不进入 Canonical Library，也不随 Shared Pack 分享。
 */
interface FavoritesContextValue {
  /** 当前已收藏的作品 ID 集合（内存镜像）。 */
  favoriteIds: Set<string>;
  /** 已收藏数量，用于侧栏徽标。 */
  count: number;
  /** 某作品是否被收藏。 */
  isFavorite: (workId: string) => boolean;
  /** 切换收藏状态，返回操作后的最新状态。 */
  toggleFavorite: (workId: string) => Promise<boolean>;
  /** 首次拉取是否仍在进行。 */
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/presentation/favorites")
      .then((response) => response.json())
      .then((data: { ids?: string[] }) => {
        if (!active) return;
        setFavoriteIds(new Set(data.ids ?? []));
      })
      .catch(() => {
        // 拉取失败（例如没有可写资料库）时静默降级为“无收藏”，不阻塞页面。
        if (active) setFavoriteIds(new Set());
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const isFavorite = useCallback((workId: string) => favoriteIds.has(workId), [favoriteIds]);

  const toggleFavorite = useCallback(
    async (workId: string) => {
      const next = !favoriteIds.has(workId);
      // 乐观更新：先改内存，再回写；失败则回滚。
      setFavoriteIds((prev) => {
        const copy = new Set(prev);
        if (next) copy.add(workId);
        else copy.delete(workId);
        return copy;
      });

      try {
        const response = await fetch(`/api/presentation/work/${workId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ favorite: next }),
        });
        if (!response.ok) throw new Error("保存收藏失败");
      } catch {
        // 回滚乐观更新。
        setFavoriteIds((prev) => {
          const copy = new Set(prev);
          if (next) copy.delete(workId);
          else copy.add(workId);
          return copy;
        });
      }

      return next;
    },
    [favoriteIds],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favoriteIds,
      count: favoriteIds.size,
      isFavorite,
      toggleFavorite,
      loading,
    }),
    [favoriteIds, isFavorite, toggleFavorite, loading],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites 必须在 FavoritesProvider 内部使用。");
  return context;
}
