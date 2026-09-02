import type { Asset } from "@/domain/entities/asset";
import type { Person } from "@/domain/entities/person";
import type { Work } from "@/domain/entities/work";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import { getPresentationPreference } from "@/infrastructure/presentation/presentation-preference-store";

export async function resolvePersonPortraitAsset(
  repository: LibraryRepository,
  person: Person,
): Promise<Asset | null> {
  const preference = await getPresentationPreference("person", person.id);
  if (preference?.preferredPortraitAssetId) {
    const preferred = await repository.findAssetById(preference.preferredPortraitAssetId);
    if (preferred) return preferred;
  }
  return person.portraitAssetId ? repository.findAssetById(person.portraitAssetId) : null;
}

export async function resolveWorkCoverAsset(
  repository: LibraryRepository,
  work: Work,
): Promise<Asset | null> {
  const preference = await getPresentationPreference("work", work.id);
  if (preference?.preferredCoverAssetId) {
    const preferred = await repository.findAssetById(preference.preferredCoverAssetId);
    if (preferred) return preferred;
  }

  const assets = await Promise.all(work.assetIds.map((id) => repository.findAssetById(id)));
  return assets.find((asset): asset is Asset => asset !== null && ["poster", "cover"].includes(asset.type)) ?? null;
}

export function assetDisplayUrl(asset: Asset): string {
  return `/api/assets/${encodeURIComponent(asset.id)}/content`;
}

export async function listPersonAssets(
  repository: LibraryRepository,
  person: Person,
): Promise<Asset[]> {
  const [subjectAssets, referencedAssets] = await Promise.all([
    repository.listAssetsForSubject("person", person.id),
    Promise.all(
      [person.portraitAssetId, ...person.galleryAssetIds]
        .filter((id): id is string => Boolean(id))
        .map((id) => repository.findAssetById(id)),
    ),
  ]);
  return uniqueAssets([...subjectAssets, ...referencedAssets.filter((item): item is Asset => item !== null)]);
}

export async function listWorkAssets(
  repository: LibraryRepository,
  work: Work,
): Promise<Asset[]> {
  const [subjectAssets, referencedAssets] = await Promise.all([
    repository.listAssetsForSubject("work", work.id),
    Promise.all(work.assetIds.map((id) => repository.findAssetById(id))),
  ]);
  return uniqueAssets([...subjectAssets, ...referencedAssets.filter((item): item is Asset => item !== null)]);
}

function uniqueAssets(assets: Asset[]): Asset[] {
  return [...new Map(assets.map((asset) => [asset.id, asset])).values()];
}
