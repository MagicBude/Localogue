import type { Metadata } from "next";

import { localizeText } from "@/application/services/localization-service";
import { CatalogPage } from "@/components/catalog-page";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "标签" };

export default async function TagsPage() {
  const preferences = await getUserPreferences();
  const dictionary = getUiDictionary(preferences.uiLanguage);
  const tags = await libraryRepository.listTags();
  const items = await Promise.all(
    tags.map(async (tag) => ({
      id: tag.id,
      label: localizeText(tag.names, preferences.metadataLanguage, tag.id),
      count: (await libraryRepository.listWorks({ tagIds: [tag.id], page: 1, pageSize: 1 })).total,
      href: `/works?tag=${encodeURIComponent(tag.id)}`,
    })),
  );

  return <CatalogPage countLabel={dictionary.works} eyebrow="CATALOG · TAG" items={items} title={dictionary.tagCatalog} />;
}
