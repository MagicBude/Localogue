import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  const operationVersions = useRef(new Map<string, number>());

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
      const version = (operationVersions.current.get(workId) ?? 0) + 1;
      operationVersions.current.set(workId, version);
      // 乐观状态同样按字段合并；收藏与评分快速连续点击时，后一个动作不会在界面中抹掉前一个。
      setPreferences((current) => upsertPreference(current, workId, patch));
      try {
        const saved = await repository.updatePresentationPreference("work", workId, {
          ...(patch.favorite !== undefined ? { favorite: patch.favorite } : {}),
          ...(patch.rating !== undefined ? { rating: patch.rating === null ? undefined : patch.rating } : {}),
        });
        // 旧请求可以先完成，但只有当前实体最新一次操作才能校正内存快照。
        if (operationVersions.current.get(workId) === version) {
          setPreferences((current) => replacePreference(current, saved));
        }
        // 此时 Native 写入已经完成，随后触发的作品查询一定能读到新值。
        setPersistedRevision((value) => value + 1);
      } catch (error: unknown) {
        setMessage(t("保存失败：{error}", { error: error instanceof Error ? error.message : String(error) }));
        if (operationVersions.current.get(workId) === version) {
          void repository.listPresentationPreferences().then(setPreferences).catch(() => undefined);
        }
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

function upsertPreference(
  values: PresentationPreference[],
  workId: string,
  patch: { favorite?: boolean; rating?: number | null },
): PresentationPreference[] {
  const existing = values.find((item) => item.entityType === "work" && item.entityId === workId);
  return replacePreference(values, {
    ...(existing ?? {}),
    schemaVersion: 1,
    id: existing?.id ?? `presentation_work_${workId}`,
    entityType: "work",
    entityId: workId,
    ...(patch.favorite !== undefined ? { favorite: patch.favorite } : {}),
    ...(patch.rating !== undefined ? { rating: patch.rating === null ? undefined : patch.rating } : {}),
    updatedAt: new Date().toISOString(),
  });
}

function replacePreference(values: PresentationPreference[], next: PresentationPreference): PresentationPreference[] {
  return [...values.filter((item) => !(item.entityType === next.entityType && item.entityId === next.entityId)), next];
}

export function useFavorites(): FavoritesValue {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error("useFavorites must be used inside DesktopFavoritesProvider");
  return value;
}
