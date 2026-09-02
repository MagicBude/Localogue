import type { Person } from "@/domain/entities/person";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import { resolvePersonPortraitAsset, assetDisplayUrl } from "@/application/assets/presentation-asset-service";
import {
  getPreferredPersonName,
  localizeText,
} from "@/application/services/localization-service";

export interface PersonCardViewModel {
  id: string;
  name: string;
  secondaryName?: string;
  status: Person["activityStatus"];
  portraitPath?: string;
  workCount: number;
}

export async function presentPersonCard(
  repository: LibraryRepository,
  person: Person,
  language: SupportedLanguage,
): Promise<PersonCardViewModel> {
  const [asset, works] = await Promise.all([
    resolvePersonPortraitAsset(repository, person),
    repository.listWorks({ personIds: [person.id], page: 1, pageSize: 1 }),
  ]);

  const primaryName = getPreferredPersonName(person, language);
  const secondary = person.names.find(
    (name) => name.type === "romanized" && name.value !== primaryName,
  );

  return {
    id: person.id,
    name: primaryName,
    secondaryName: secondary?.value,
    status: person.activityStatus,
    portraitPath: asset ? assetDisplayUrl(asset) : undefined,
    workCount: works.total,
  };
}

export async function getPersonBiography(
  person: Person,
  language: SupportedLanguage,
): Promise<string> {
  return localizeText(person.biographies, language);
}
