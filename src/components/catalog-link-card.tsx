import Link from "next/link";

interface CatalogLinkCardProps {
  href: string;
  title: string;
  subtitle?: string;
  count?: number;
  countLabel?: string;
}

/**
 * 分类浏览页的通用卡片。
 *
 * 它故意保持“只负责展示”，不负责查询数据；这样 Maker、Label、Series、Genre
 * 等页面可以复用同一个 UI，而各自的数据来源仍由页面层明确组织。
 */
export function CatalogLinkCard({
  href,
  title,
  subtitle,
  count,
  countLabel = "",
}: CatalogLinkCardProps) {
  return (
    <Link className="catalog-card" href={href}>
      <div>
        <strong>{title}</strong>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {count !== undefined ? (
        <span>
          {count} {countLabel}
        </span>
      ) : (
        <span aria-hidden="true">→</span>
      )}
    </Link>
  );
}
