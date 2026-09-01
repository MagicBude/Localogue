import type { Metadata } from "next";

import { getPreferredPersonName } from "@/application/services/localization-service";
import { CatalogPage } from "@/components/catalog-page";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "导演" };

export default async function DirectorsPage() {
  const preferences = await getUserPreferences();
  const dictionary = getUiDictionary(preferences.uiLanguage);
  const people = (await libraryRepository.listPeople({ page: 1, pageSize: 9999 })).items;

  const rows = await Promise.all(
    people.map(async (person) => ({
      person,
      count: (await libraryRepository.listWorks({ directorIds: [person.id], page: 1, pageSize: 1 })).total,
    })),
  );

  const items = rows
    .filter((row) => row.count > 0)
    .map(({ person, count }) => ({
      id: person.id,
      label: getPreferredPersonName(person, preferences.metadataLanguage),
      count,
      href: `/works?director=${encodeURIComponent(person.id)}`,
      subtitle: dictionary.openWorks,
    }));

  return <CatalogPage countLabel={dictionary.works} eyebrow="CATALOG · DIRECTOR" items={items} title={dictionary.directors} />;
}
