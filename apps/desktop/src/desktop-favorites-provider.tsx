import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { PresentationPreference } from "@/domain/entities/presentation-preference";
import type { TauriLibraryRepository } from "./platform/tauri-library-repository";

/**
 * 桌面端收藏 / 评分的私人展示偏好上下文。
 *
 * 数据来源与网页端一致：PresentationPreference（私人层，不污染 Canonical Work、
 * 不进 Shared Pack）。区别是桌面端直接走 repository.savePresentationPreference，
 * 由 desktopBridge 写入 Private Library，不经过 Web 的 /api/presentation/* 路由。
 *
 * 这里只持有“全部作品偏好”的内存快照，供组件快速判断某作是否收藏、几星评分，
 * 并对外暴露乐观更新的 toggleFavorite / setRating。底层 listWorks 仍按需读取
 * 同一份偏好来完成 favoriteOnly / ratingMin / 评分排序，与 Web 行为对齐。
 */
interface FavoritesValue {
  favoriteIds: ReadonlySet<string>;
  ratingById: ReadonlyMap<string, number>;
  favoriteCount: number;
  isFavorite: (id: string) => boolean;
  getRating: (id: string) => number | undefined;
  toggleFavorite: (id: string) => void;
  setRating: (id: string, rating: number | undefined) => void;
}

const FavoritesContext = createContext<FavoritesValue | null>(null);

export function DesktopFavoritesProvider({
  repository,
  children,
}: {
  repository: TauriLibraryRepository;
  children: ReactNode;
}) {
  const [preferences, setPreferences] = useState<PresentationPreference[]>([]);

  useEffect(() => {
    let disposed = false;
    void repository.listPresentationPreferences().then((items) => {
      if (!disposed) setPreferences(items);
    }).catch(() => {
      // 读取失败不阻断界面；收藏按钮会表现为“未收藏”，刷新可重试。
    });
    return () => { disposed = true; };
  }, [repository]);

  const value = useMemo<FavoritesValue>(() => {
    const favoriteIds = new Set<string>();
    const ratingById = new Map<string, number>();
    for (const pref of preferences) {
      if (pref.entityType !== "work") continue;
      if (pref.favorite === true) favoriteIds.add(pref.entityId);
      if (typeof pref.rating === "number") ratingById.set(pref.entityId, pref.rating);
    }

    const persist = async (
      workId: string,
      patch: { favorite?: boolean; rating?: number | null },
    ): Promise<void> => {
      const existing = preferences.find(
        (item) => item.entityType === "work" && item.entityId === workId,
      );
      const next: PresentationPreference = {
        schemaVersion: 1,
        id: existing?.id ?? `presentation_work_${workId}`,
        entityType: "work",
        entityId: workId,
        favorite: patch.favorite ?? existing?.favorite,
        rating: patch.rating !== undefined
          ? (patch.rating === null ? undefined : patch.rating)
          : existing?.rating,
        preferredPortraitAssetId: existing?.preferredPortraitAssetId,
        preferredCoverAssetId: existing?.preferredCoverAssetId,
        updatedAt: new Date().toISOString(),
      };
      // 乐观更新内存快照，确保 UI 立即响应；持久化失败也保留本地状态。
      setPreferences((current) => [
        ...current.filter(
          (item) => !(item.entityType === "work" && item.entityId === workId),
        ),
        next,
      ]);
      try {
        await repository.savePresentationPreference(next);
      } catch {
        // 写入失败：保留乐观状态，等待下次用户操作或刷新重试。
      }
    };

    return {
      favoriteIds,
      ratingById,
      favoriteCount: favoriteIds.size,
      isFavorite: (id) => favoriteIds.has(id),
      getRating: (id) => ratingById.get(id),
      toggleFavorite: (id) => void persist(id, { favorite: !favoriteIds.has(id) }),
      setRating: (id, rating) => void persist(id, { rating: rating ?? null }),
    };
  }, [preferences, repository]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesValue {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error("useFavorites must be used inside DesktopFavoritesProvider");
  return value;
}
