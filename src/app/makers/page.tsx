import type { Metadata } from "next";

import { localizeText } from "@/application/services/localization-service";
import { CatalogPage } from "@/components/catalog-page";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "厂商" };

export default async function MakersPage() {
  const preferences = await getUserPreferences();
  const dictionary = getUiDictionary(preferences.uiLanguage);
  const makers = (await libraryRepository.listOrganizations()).filter(
    (item) => item.kind === "maker",
  );

  const items = await Promise.all(
    makers.map(async (maker) => ({
      id: maker.id,
      label: localizeText(
        maker.names,
        preferences.metadataLanguage,
        maker.id,
      ),
      count: (
        await libraryRepository.listWorks({
          makerIds: [maker.id],
          page: 1,
          pageSize: 1,
        })
      ).total,
      href: `/makers/${maker.id}`,
    })),
  );

  return (
    <CatalogPage
      countLabel={dictionary.works}
      eyebrow="CATALOG · MAKER"
      items={items}
      title={dictionary.makers}
    />
  );
}
