import type { Metadata } from "next";

import { getVocabularyLabelMap } from "@/application/services/vocabulary-service";
import { CatalogPage } from "@/components/catalog-page";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { vocabularyRepository } from "@/infrastructure/repositories/vocabulary-provider";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "作品类型" };

export default async function WorkTypesPage() {
  const preferences = await getUserPreferences();
  const dictionary = getUiDictionary(preferences.uiLanguage);
  const labels = await getVocabularyLabelMap(
    vocabularyRepository,
    "work-types",
    preferences.metadataLanguage,
  );

  const items = await Promise.all(
    [...labels.entries()].map(async ([id, label]) => ({
      id,
      label,
      count: (await libraryRepository.listWorks({ workTypeIds: [id], page: 1, pageSize: 1 })).total,
      href: `/works?workType=${encodeURIComponent(id)}`,
    })),
  );

  return <CatalogPage countLabel={dictionary.works} eyebrow="CATALOG · WORK TYPE" items={items} title={dictionary.workTypeCatalog} />;
}
