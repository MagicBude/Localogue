import type { TauriLibraryRepository } from "./platform/tauri-library-repository";
import { DesktopWorkExplorer } from "./desktop-work-explorer";
import { useFavorites } from "./desktop-favorites-provider";
import { useDesktopI18n } from "./desktop-i18n";

/**
 * 桌面端收藏页。
 *
 * 直接复用 Web/Desktop 共用的 DesktopWorkExplorer，初始查询限定 favoriteOnly: true。
 * 收藏数据来自私人展示偏好层，不修改 Canonical Work、不进 Shared Pack。
 *
 * 用 favoriteCount 作为 key 强制重挂载：在收藏页取消收藏时，explorer 会重新执行
 * listWorks 并立即反映最新的收藏集合，无需额外刷新按钮。
 */
export function DesktopFavoritesPage({
  repository,
  openWork,
}: {
  repository: TauriLibraryRepository;
  openWork: (id: string) => void;
}) {
  const { t } = useDesktopI18n();
  const { favoriteCount } = useFavorites();

  return (
    <div className="page-stack">
      <section className="page-title">
        <span className="eyebrow">FAVORITES · PRESENTATION PREFERENCE</span>
        <h1>{t("收藏")}</h1>
        <p>{t("你收藏的作品。收藏与评分保存在私人展示偏好层，不修改 Canonical Work，也不进入 Shared Pack。")}</p>
      </section>
      {favoriteCount === 0 ? (
        <section className="empty-state">
          <p>{t("你还没有收藏任何作品。前往作品库点击心形图标即可收藏。")}</p>
        </section>
      ) : (
        <DesktopWorkExplorer
          key={favoriteCount}
          repository={repository}
          onOpen={openWork}
          storageKey="localogue.desktop.favorites-view"
          initialQuery={{ favoriteOnly: true }}
        />
      )}
    </div>
  );
}
