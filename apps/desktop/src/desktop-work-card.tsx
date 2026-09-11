import { DesktopAssetImage } from "./desktop-asset-image";
import { DesktopFavoriteButton } from "./desktop-favorite-button";
import { useDesktopI18n } from "./desktop-i18n";
import type { DesktopWorkCardViewModel } from "./desktop-work-results";
import { UiTooltip } from "./ui/tooltip";

interface DesktopWorkCardProps {
  card: DesktopWorkCardViewModel;
  layout?: "grid" | "cover" | "waterfall";
  onOpen: (id: string) => void;
  onOpenPerson?: (id: string) => void;
  onSelectGenre?: (id: string) => void;
  onSelectTag?: (id: string) => void;
}

/**
 * 桌面端作品卡片（海报墙 / 封面墙 / 瀑布流共用）。
 *
 * 设计对齐网页端 WorkCard：圆角海报、悬浮时右上角浮出“查看”快捷按钮、
 * 标题/番号/演员/类型 chip 的信息层级；收藏按钮作为卡片级别的 Presentation
 * Preference 操作，不修改 Canonical Work。
 */
export function DesktopWorkCard({ card, layout = "grid", onOpen, onOpenPerson, onSelectGenre, onSelectTag }: DesktopWorkCardProps) {
  const { t } = useDesktopI18n();
  const { work, title, releaseDate, performers, makerName, workTypeNames, genres, tags, poster, fanart } = card;
  const visiblePerformers = performers.slice(0, 3);
  const hiddenPerformerCount = performers.length - visiblePerformers.length;
  const visibleGenres = genres.slice(0, 4);
  const visibleTags = tags.slice(0, Math.max(0, 6 - visibleGenres.length));
  const hiddenClassificationCount = genres.length + tags.length - visibleGenres.length - visibleTags.length;
  // 海报墙和瀑布流使用 poster；独立封面墙使用 fanart。
  const displayAsset = layout === "cover" ? fanart : poster;

  return (
    <article className={`desktop-work-card is-${layout}`}>
      <div className="desktop-work-card__media">
        <DesktopFavoriteButton variant="card" workId={work.id} />

        <button
          className="desktop-work-card__poster"
          onClick={() => onOpen(work.id)}
          type="button"
          aria-label={`${work.code} ${title}`}
        >
          <DesktopAssetImage
            asset={displayAsset}
            alt={`${work.code} cover`}
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
          {workTypeNames.slice(0, 2).map((label) => (
            <span className="desktop-work-card__chip" key={label}>{label}</span>
          ))}
        </div>
        <h3 title={title}>
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
          {makerName ? <span title={makerName}>{makerName}</span> : null}
        </div>

        {performers.length ? (
          <div className="desktop-work-card__people" aria-label={t("演员")}>
            {visiblePerformers.map((performer) => onOpenPerson ? (
              <UiTooltip
                key={performer.id}
                rich
                side="top"
                label={<PersonPreview performer={performer} />}
              >
                <button onClick={() => onOpenPerson(performer.id)} type="button">{performer.name}</button>
              </UiTooltip>
            ) : <span key={performer.id}>{performer.name}</span>)}
            {hiddenPerformerCount > 0 ? <span className="desktop-work-card__more">+{hiddenPerformerCount}</span> : null}
          </div>
        ) : makerName ? (
          <p className="desktop-work-card__people">{makerName}</p>
        ) : null}

        {genres.length || tags.length ? (
          <div className="desktop-work-card__classifications">
            {visibleGenres.map((genre) => (
              <button className="is-genre" disabled={!onSelectGenre} key={genre.id} onClick={() => onSelectGenre?.(genre.id)} type="button">{genre.label}</button>
            ))}
            {visibleTags.map((tag) => (
              <button className="is-tag" disabled={!onSelectTag} key={tag.id} onClick={() => onSelectTag?.(tag.id)} type="button">{tag.label}</button>
            ))}
            {hiddenClassificationCount > 0 ? <span className="desktop-work-card__more">+{hiddenClassificationCount}</span> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function PersonPreview({ performer }: { performer: DesktopWorkCardViewModel["performers"][number] }) {
  const { t } = useDesktopI18n();
  const aliases = performer.person.names
    .filter((name) => name.value !== performer.name)
    .map((name) => name.value)
    .filter((name, index, values) => values.indexOf(name) === index)
    .slice(0, 3);
  return (
    <span className="desktop-person-preview">
      <strong>{performer.name}</strong>
      <span>{personStatusLabel(performer.person.activityStatus, t)}</span>
      {performer.person.birthDate?.value ? <span>{t("出生日期")} · {performer.person.birthDate.value}</span> : null}
      {performer.person.heightCm ? <span>{t("身高")} · {performer.person.heightCm} cm</span> : null}
      {aliases.length ? <small>{t("别名")} · {aliases.join(" / ")}</small> : null}
    </span>
  );
}

function personStatusLabel(status: DesktopWorkCardViewModel["performers"][number]["person"]["activityStatus"], t: (source: string) => string): string {
  switch (status) {
    case "active": return t("活跃");
    case "retired": return t("已引退");
    case "hiatus": return t("休业");
    case "inactive": return t("非活跃");
    default: return t("状态未知");
  }
}

function PosterPlaceholder({ code }: { code: string }) {
  return (
    <div className="desktop-poster-placeholder" aria-hidden="true">
      <b>{code}</b>
      <small>暂无封面</small>
    </div>
  );
}
