import type { Metadata } from "next";

import { CatalogLinkCard } from "@/components/catalog-link-card";
import { getUiDictionary } from "@/i18n/ui";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "分类浏览" };

export default async function BrowsePage() {
  const preferences = await getUserPreferences();
  const dictionary = getUiDictionary(preferences.uiLanguage);

  const entries = [
    { href: "/makers", title: dictionary.makers },
    { href: "/labels", title: dictionary.labels },
    { href: "/series", title: dictionary.series },
    { href: "/genres", title: dictionary.genres },
    { href: "/directors", title: dictionary.directors },
    { href: "/work-types", title: dictionary.workTypeCatalog },
    { href: "/tags", title: dictionary.tagCatalog },
  ];

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">EXPLORE · CATALOG INDEX</span>
          <h1>{dictionary.browseCatalog}</h1>
          <p className="muted">{dictionary.browseCatalogDescription}</p>
        </div>
      </section>

      <section className="catalog-grid">
        {entries.map((entry) => (
          <CatalogLinkCard href={entry.href} key={entry.href} title={entry.title} />
        ))}
      </section>
    </div>
  );
}
