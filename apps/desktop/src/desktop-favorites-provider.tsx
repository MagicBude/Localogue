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
import { useDesktopI18n } from "./desktop-i18n";

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
  /** 每次成功写入私人偏好后递增，供依赖磁盘查询的作品列表精确刷新。 */
  persistedRevision: number;
  isFavorite: (id: string) => boolean;
  getRating: (id: string) => number | undefined;
  toggleFavorite: (id: string) => void;
  setRating: (id: string, rating: number | undefined) => void;
}

const FavoritesContext = createContext<FavoritesValue | null>(null);

export function DesktopFavoritesProvider({
  repository,
  children,
  setMessage,
}: {
  repository: TauriLibraryRepository;
  children: ReactNode;
  setMessage: (message: string) => void;
}) {
  const { t } = useDesktopI18n();
  const [preferences, setPreferences] = useState<PresentationPreference[]>([]);
  const [persistedRevision, setPersistedRevision] = useState(0);

  useEffect(() => {
    let disposed = false;
    void repository.listPresentationPreferences().then((items) => {
      if (!disposed) setPreferences(items);
    }).catch((error: unknown) => {
      if (!disposed) setMessage(t("读取收藏与评分失败：{error}", { error: error instanceof Error ? error.message : String(error) }));
    });
    return () => { disposed = true; };
  }, [repository, setMessage, t]);

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
      // 乐观更新内存快照；持久化失败回滚本次结果，并明确告知用户保存没有成功。
      setPreferences((current) => [
        ...current.filter(
          (item) => !(item.entityType === "work" && item.entityId === workId),
        ),
        next,
      ]);
      try {
        await repository.savePresentationPreference(next);
        // 此时 Native 写入已经完成，随后触发的作品查询一定能读到新值。
        setPersistedRevision((value) => value + 1);
      } catch (error: unknown) {
        setMessage(t("保存失败：{error}", { error: error instanceof Error ? error.message : String(error) }));
        // 仅当内存里仍是本次乐观结果时回滚。若用户已经进行了更新的操作，
        // 旧请求失败不能覆盖新状态；对象引用在这里充当这一轮操作的身份标记。
        setPreferences((current) => {
          const currentItem = current.find(
            (item) => item.entityType === "work" && item.entityId === workId,
          );
          if (currentItem !== next) return current;
          const withoutOptimistic = current.filter(
            (item) => !(item.entityType === "work" && item.entityId === workId),
          );
          return existing ? [...withoutOptimistic, existing] : withoutOptimistic;
        });
      }
    };

    return {
      favoriteIds,
      ratingById,
      favoriteCount: favoriteIds.size,
      persistedRevision,
      isFavorite: (id) => favoriteIds.has(id),
      getRating: (id) => ratingById.get(id),
      toggleFavorite: (id) => void persist(id, { favorite: !favoriteIds.has(id) }),
      setRating: (id, rating) => void persist(id, { rating: rating ?? null }),
    };
  }, [preferences, persistedRevision, repository, setMessage, t]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesValue {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error("useFavorites must be used inside DesktopFavoritesProvider");
  return value;
}
