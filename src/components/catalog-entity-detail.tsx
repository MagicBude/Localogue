import Link from "next/link";

import type { WorkCardViewModel } from "@/application/services/work-presentation-service";
import { WorkResults } from "@/components/work-results";
import type { LocalizedText } from "@/domain/value-objects/localized-text";
import { supportedLanguages } from "@/domain/value-objects/localized-text";
import type { UiDictionary } from "@/i18n/ui";

interface DetailLink {
  href: string;
  label: string;
}

interface CatalogEntityDetailProps {
  eyebrow: string;
  title: string;
  description?: string;
  names: LocalizedText;
  dictionary: UiDictionary;
  works: WorkCardViewModel[];
  totalWorks: number;
  worksHref: string;
  workTypeLabels: Map<string, string>;
  facts?: Array<{ label: string; value: string }>;
  relatedTitle?: string;
  relatedLinks?: DetailLink[];
}

/**
 * Maker / Label / Series 共用的详情页展示组件。
 *
 * Domain Entity 不同，但“名称 → 简介 → 关系 → 相关作品”的阅读结构高度一致。
 * 把共同的 UI 提取出来，可以减少重复代码，同时保持每个路由的数据获取逻辑清晰可学。
 */
export function CatalogEntityDetail({
  eyebrow,
  title,
  description,
  names,
  dictionary,
  works,
  totalWorks,
  worksHref,
  workTypeLabels,
  facts = [],
  relatedTitle,
  relatedLinks = [],
}: CatalogEntityDetailProps) {
  return (
    <div className="page-stack">
      <section className="catalog-detail-hero">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          {description ? <p className="catalog-detail-hero__description">{description}</p> : null}
        </div>

        <div className="catalog-detail-hero__meta">
          <div>
            <span>{dictionary.localizedNames}</span>
            <dl className="localized-name-list">
              {supportedLanguages.map((language) => (
                <div key={language}>
                  <dt>{language}</dt>
                  <dd>{names[language] ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </div>

          {facts.length ? (
            <dl className="catalog-detail-facts">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </section>

      {relatedLinks.length ? (
        <section className="detail-section">
          <h2>{relatedTitle}</h2>
          <div className="chip-row">
            {relatedLinks.map((item) => (
              <Link className="chip chip--strong" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="section-heading section-heading--action">
          <div>
            <span className="eyebrow">RELATED WORKS</span>
            <h2>{dictionary.works}</h2>
            <p className="muted">
              {totalWorks} {dictionary.resultCount}
            </p>
          </div>
          <Link className="secondary-button" href={worksHref}>
            {dictionary.browseWorks} →
          </Link>
        </div>

        {works.length ? (
          <WorkResults
            dictionary={dictionary}
            view="grid"
            works={works}
            workTypeLabels={workTypeLabels}
          />
        ) : null}
      </section>
    </div>
  );
}
