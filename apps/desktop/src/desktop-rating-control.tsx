import { useDesktopI18n } from "./desktop-i18n";
import { useFavorites } from "./desktop-favorites-provider";

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * 桌面端 1–5 星个人评分控件。
 *
 * 评分属于私人展示偏好层（PresentationPreference.rating），与收藏共用同一上下文。
 * 再次点击当前星级即清除评分；不修改任何公共元数据。
 */
export function DesktopRatingControl({ workId }: { workId: string }) {
  const { t } = useDesktopI18n();
  const { getRating, setRating } = useFavorites();
  const current = getRating(workId);

  return (
    <div className="rating-control" role="radiogroup" aria-label={t("评分")}>
      {STARS.map((star) => {
        const active = current !== undefined && star <= current;
        return (
          <button
            type="button"
            key={star}
            className={`rating-star${active ? " is-active" : ""}`}
            aria-label={`${t("评分")} ${star}`}
            aria-pressed={current === star}
            title={`${star} ★`}
            onClick={() => setRating(workId, current === star ? undefined : star)}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
