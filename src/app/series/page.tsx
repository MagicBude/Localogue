import type { Metadata } from "next";

import { localizeText } from "@/application/services/localization-service";
import { CatalogPage } from "@/components/catalog-page";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "系列" };

export default async function SeriesPage() {
  const preferences = await getUserPreferences();
  const dictionary = getUiDictionary(preferences.uiLanguage);
  const series = await libraryRepository.listSeries();
  const items = await Promise.all(
    series.map(async (item) => ({
      id: item.id,
      label: localizeText(item.names, preferences.metadataLanguage, item.id),
      count: (await libraryRepository.listWorks({ seriesIds: [item.id], page: 1, pageSize: 1 })).total,
      href: `/series/${item.id}`,
    })),
  );

  return <CatalogPage countLabel={dictionary.works} eyebrow="CATALOG · SERIES" items={items} title={dictionary.series} />;
}
