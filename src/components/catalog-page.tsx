import { CatalogLinkCard } from "@/components/catalog-link-card";

export interface CatalogPageItem {
  id: string;
  label: string;
  href: string;
  count: number;
  subtitle?: string;
}

interface CatalogPageProps {
  countLabel: string;
  eyebrow: string;
  items: CatalogPageItem[];
  title: string;
}

/**
 * Maker、Label、Series、Genre 等“分类索引页”的共同外壳。
 *
 * 页面之间真正不同的是“数据如何取得、点击后生成什么筛选参数”；
 * 标题区和卡片网格属于共同 UI，因此提取为一个可复用组件。
 */
export function CatalogPage({
  countLabel,
  eyebrow,
  items,
  title,
}: CatalogPageProps) {
  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
        </div>
      </section>

      <section className="catalog-grid">
        {items.map((item) => (
          <CatalogLinkCard
            count={item.count}
            countLabel={countLabel}
            href={item.href}
            key={item.id}
            subtitle={item.subtitle}
            title={item.label}
          />
        ))}
      </section>
    </div>
  );
}
