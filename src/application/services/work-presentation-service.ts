import { assetDisplayUrl, resolveWorkCoverAsset } from "@/application/assets/presentation-asset-service";
import type { Asset } from "@/domain/entities/asset";
import type { Organization } from "@/domain/entities/organization";
import type { Person } from "@/domain/entities/person";
import type { Series } from "@/domain/entities/series";
import type { Work } from "@/domain/entities/work";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import type { SupportedLanguage } from "@/domain/value-objects/localized-text";
import {
  getPreferredPersonName,
  localizeText,
} from "@/application/services/localization-service";

export interface WorkCardViewModel {
  id: string;
  code: string;
  title: string;
  releaseDate: string;
  durationMinutes?: number;
  performerNames: string[];
  makerName?: string;
  posterPath?: string;
  posterAssetId?: string;
  workTypeIds: string[];
}

export interface WorkDetailViewModel extends WorkCardViewModel {
  description: string;
  performers: Array<{ id: string; name: string }>;
  directors: Array<{ id: string; name: string }>;
  maker?: Organization;
  label?: Organization;
  series: Series[];
  assets: Asset[];
  genreIds: string[];
  tagIds: string[];
  mediaFileIds: string[];
}

async function loadPeople(
  repository: LibraryRepository,
  ids: string[],
): Promise<Person[]> {
  const items = await Promise.all(ids.map((id) => repository.findPersonById(id)));
  return items.filter((item): item is Person => item !== null);
}

export async function presentWorkCard(
  repository: LibraryRepository,
  work: Work,
  language: SupportedLanguage,
): Promise<WorkCardViewModel> {
  const performerIds = work.personRelations
    .filter((relation) => relation.role === "performer")
    .sort((a, b) => (a.billingOrder ?? 999) - (b.billingOrder ?? 999))
    .map((relation) => relation.personId);

  const [performers, maker, poster] = await Promise.all([
    loadPeople(repository, performerIds),
    work.makerId
      ? repository.findOrganizationById(work.makerId)
      : Promise.resolve(null),
    resolveWorkCoverAsset(repository, work),
  ]);

  return {
    id: work.id,
    code: work.code,
    title: localizeText(work.titles, language),
    releaseDate: work.releaseDate?.value ?? "—",
    durationMinutes: work.durationMinutes,
    performerNames: performers.map((person) =>
      getPreferredPersonName(person, language),
    ),
    makerName: maker ? localizeText(maker.names, language) : undefined,
    posterPath: poster ? assetDisplayUrl(poster) : undefined,
    posterAssetId: poster?.id,
    workTypeIds: work.workTypeIds,
  };
}

export async function presentWorkDetail(
  repository: LibraryRepository,
  work: Work,
  language: SupportedLanguage,
): Promise<WorkDetailViewModel> {
  const performerIds = work.personRelations
    .filter((relation) => relation.role === "performer")
    .map((relation) => relation.personId);
  const directorIds = work.personRelations
    .filter((relation) => relation.role === "director")
    .map((relation) => relation.personId);

  const [card, performers, directors, maker, label, series, assets] =
    await Promise.all([
      presentWorkCard(repository, work, language),
      loadPeople(repository, performerIds),
      loadPeople(repository, directorIds),
      work.makerId
        ? repository.findOrganizationById(work.makerId)
        : Promise.resolve(null),
      work.labelId
        ? repository.findOrganizationById(work.labelId)
        : Promise.resolve(null),
      Promise.all(work.seriesIds.map((id) => repository.findSeriesById(id))),
      Promise.all(work.assetIds.map((id) => repository.findAssetById(id))),
    ]);

  return {
    ...card,
    description: localizeText(work.descriptions, language),
    performers: performers.map((person) => ({
      id: person.id,
      name: getPreferredPersonName(person, language),
    })),
    directors: directors.map((person) => ({
      id: person.id,
      name: getPreferredPersonName(person, language),
    })),
    maker: maker ?? undefined,
    label: label ?? undefined,
    series: series.filter((item): item is Series => item !== null),
    assets: assets.filter((item): item is Asset => item !== null),
    genreIds: work.genreIds,
    tagIds: work.tagIds,
    mediaFileIds: work.mediaFileIds,
  };
}
