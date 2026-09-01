import type { Metadata } from "next";

import { localizeText } from "@/application/services/localization-service";
import { CatalogPage } from "@/components/catalog-page";
import { getUiDictionary } from "@/i18n/ui";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { getUserPreferences } from "@/lib/preferences";

export const metadata: Metadata = { title: "Genre" };

export default async function GenresPage() {
  const preferences = await getUserPreferences();
  const dictionary = getUiDictionary(preferences.uiLanguage);
  const genres = await libraryRepository.listGenres();
  const items = await Promise.all(
    genres.map(async (genre) => ({
      id: genre.id,
      label: localizeText(genre.names, preferences.metadataLanguage, genre.id),
      count: (await libraryRepository.listWorks({ genreIds: [genre.id], page: 1, pageSize: 1 })).total,
      href: `/works?genre=${encodeURIComponent(genre.id)}`,
    })),
  );

  return <CatalogPage countLabel={dictionary.works} eyebrow="CATALOG · GENRE" items={items} title={dictionary.genres} />;
}
