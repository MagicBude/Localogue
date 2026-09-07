import { DesktopAssetImage } from "./desktop-asset-image";
import { DesktopFavoriteButton } from "./desktop-favorite-button";
import { useDesktopI18n } from "./desktop-i18n";
import type { DesktopWorkCardViewModel } from "./desktop-work-results";

interface DesktopWorkCardProps {
  card: DesktopWorkCardViewModel;
  onOpen: (id: string) => void;
}

/**
 * 桌面端作品卡片（海报墙 / 瀑布流共用）。
 *
 * 设计对齐网页端 WorkCard：圆角海报、悬浮时右上角浮出“查看”快捷按钮、
 * 标题/番号/演员/类型 chip 的信息层级；收藏按钮作为卡片级别的 Presentation
 * Preference 操作，不修改 Canonical Work。
 */
export function DesktopWorkCard({ card, onOpen }: DesktopWorkCardProps) {
  const { t } = useDesktopI18n();
  const { work, title, releaseDate, performerNames, makerName, workTypeNames, poster } = card;

  return (
    <article className="desktop-work-card">
      <div className="desktop-work-card__media">
        <DesktopFavoriteButton variant="card" workId={work.id} />

        <button
          className="desktop-work-card__poster"
          onClick={() => onOpen(work.id)}
          type="button"
          aria-label={`${work.code} ${title}`}
        >
          <DesktopAssetImage
            asset={poster}
            alt={`${work.code} poster`}
            fallback={<PosterPlaceholder code={work.code} />}
          />
        </button>

        <button
          className="desktop-work-card__overlay"
          onClick={() => onOpen(work.id)}
          type="button"
        >
          {t("查看详情")}
        </button>
      </div>

      <div className="desktop-work-card__body">
        <div className="desktop-work-card__identity">
          <button
            className="desktop-work-card__code"
            onClick={() => onOpen(work.id)}
            type="button"
          >
            {work.code}
          </button>
          {workTypeNames.map((label) => (
            <span className="desktop-work-card__chip" key={label}>{label}</span>
          ))}
        </div>
        <h3>
          <button onClick={() => onOpen(work.id)} type="button">
            {title}
          </button>
        </h3>

        <div className="desktop-work-card__meta">
          <span>{releaseDate}</span>
          {work.durationMinutes !== undefined ? (
            <span>
              {work.durationMinutes} {t("分钟")}
            </span>
          ) : null}
        </div>

        {performerNames.length ? (
          <p className="desktop-work-card__people">{performerNames.join(" · ")}</p>
        ) : makerName ? (
          <p className="desktop-work-card__people">{makerName}</p>
        ) : null}
      </div>
    </article>
  );
}

function PosterPlaceholder({ code }: { code: string }) {
  return (
    <div className="desktop-poster-placeholder" aria-hidden="true">
      <b>{code}</b>
    </div>
  );
}
