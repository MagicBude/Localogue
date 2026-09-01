import type { Metadata } from "next";

import { localizeText } from "@/application/services/localization-service";
import { CatalogPage } from "@/components/catalog-page";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "厂牌" };

export default async function LabelsPage() {
  const preferences = await getUserPreferences();
  const dictionary = getUiDictionary(preferences.uiLanguage);
  const labels = (await libraryRepository.listOrganizations()).filter(
    (item) => item.kind === "label",
  );

  const items = await Promise.all(
    labels.map(async (label) => ({
      id: label.id,
      label: localizeText(label.names, preferences.metadataLanguage, label.id),
      count: (
        await libraryRepository.listWorks({
          labelIds: [label.id],
          page: 1,
          pageSize: 1,
        })
      ).total,
      href: `/labels/${label.id}`,
    })),
  );

  return <CatalogPage countLabel={dictionary.works} eyebrow="CATALOG · LABEL" items={items} title={dictionary.labels} />;
}
