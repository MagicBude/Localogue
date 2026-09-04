import type { Asset } from "@/domain/entities/asset";
import type { Person } from "@/domain/entities/person";
import type { PresentationPreference } from "@/domain/entities/presentation-preference";
import type { Work } from "@/domain/entities/work";

export interface PresentationResolution {
  candidates: Asset[];
  preferred?: Asset;
  fallback?: Asset;
  resolved?: Asset;
  stalePreferredAssetId?: string;
}

export function workPresentationCandidates(work: Work, assets: readonly Asset[]): Asset[] {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const referenced = work.assetIds
    .map((id) => byId.get(id))
    .filter((asset): asset is Asset => Boolean(asset));
  const owned = assets.filter((asset) => asset.subjectType === "work" && asset.subjectId === work.id);
  return uniqueAssets([...referenced, ...owned]).filter((asset) => asset.type === "poster" || asset.type === "cover");
}

export function personPresentationCandidates(person: Person, assets: readonly Asset[]): Asset[] {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const referencedIds = [person.portraitAssetId, ...person.galleryAssetIds].filter((id): id is string => Boolean(id));
  const referenced = referencedIds
    .map((id) => byId.get(id))
    .filter((asset): asset is Asset => Boolean(asset));
  const owned = assets.filter((asset) => asset.subjectType === "person" && asset.subjectId === person.id);
  return uniqueAssets([...referenced, ...owned]).filter((asset) => asset.type === "portrait" || asset.type === "gallery");
}

export function resolveWorkPresentation(
  work: Work,
  assets: readonly Asset[],
  preference?: PresentationPreference | null,
): PresentationResolution {
  const candidates = workPresentationCandidates(work, assets);
  const preferredAssetId = preference?.preferredCoverAssetId;
  const preferred = preferredAssetId ? candidates.find((asset) => asset.id === preferredAssetId) : undefined;
  const fallback = candidates.find((asset) => asset.type === "poster") ?? candidates.find((asset) => asset.type === "cover");
  return {
    candidates,
    preferred,
    fallback,
    resolved: preferred ?? fallback,
    ...(preferredAssetId && !preferred ? { stalePreferredAssetId: preferredAssetId } : {}),
  };
}

export function resolvePersonPresentation(
  person: Person,
  assets: readonly Asset[],
  preference?: PresentationPreference | null,
): PresentationResolution {
  const candidates = personPresentationCandidates(person, assets);
  const preferredAssetId = preference?.preferredPortraitAssetId;
  const preferred = preferredAssetId ? candidates.find((asset) => asset.id === preferredAssetId) : undefined;
  const fallback = candidates.find((asset) => asset.id === person.portraitAssetId)
    ?? candidates.find((asset) => asset.type === "portrait")
    ?? candidates.find((asset) => asset.type === "gallery");
  return {
    candidates,
    preferred,
    fallback,
    resolved: preferred ?? fallback,
    ...(preferredAssetId && !preferred ? { stalePreferredAssetId: preferredAssetId } : {}),
  };
}

export function makePresentationPreferenceId(entityType: "person" | "work", entityId: string): string {
  return `presentation_${entityType}_${entityId}`;
}

function uniqueAssets(assets: readonly Asset[]): Asset[] {
  return [...new Map(assets.map((asset) => [asset.id, asset])).values()];
}
