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
 * DesktopWorkExplorer 会订阅“偏好成功持久化版本”，因此取消收藏后会在磁盘写入
 * 完成时重新执行 listWorks；页面无需通过 key 销毁整个筛选器及其编辑状态。
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
          repository={repository}
          onOpen={openWork}
          storageKey="localogue.desktop.favorites-view"
          initialQuery={{ favoriteOnly: true }}
        />
      )}
    </div>
  );
}
