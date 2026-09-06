import type { Asset } from "@/domain/entities/asset";
import type { AssetDeletionReceipt } from "@/domain/entities/asset-deletion";
import type { Person } from "@/domain/entities/person";
import type { Work } from "@/domain/entities/work";

import type { TauriLibraryRepository } from "./platform/tauri-library-repository";

type AssetSubject = Work | Person;

/**
 * 把 Asset 移入可恢复回收站。
 *
 * JSON V1 没有数据库事务，所以按“先写恢复依据 → 再解除引用 → 最后删除 Asset”执行。
 * 任一步失败都会尽力把主体引用恢复，并把 Receipt 标成 failed，不能把半完成操作伪装成成功。
 */
export async function recyclePrivateAsset(
  repository: TauriLibraryRepository,
  asset: Asset,
  subject: AssetSubject,
): Promise<AssetDeletionReceipt> {
  const subjectType = isWork(subject) ? "work" : "person";
  const now = new Date().toISOString();
  const receipt: AssetDeletionReceipt = {
    schemaVersion: 1,
    id: `asset_deletion_${crypto.randomUUID()}`,
    asset,
    subjectType,
    subjectId: subject.id,
    workAssetLinked: isWork(subject) ? subject.assetIds.includes(asset.id) : undefined,
    personPortraitLinked: !isWork(subject) ? subject.portraitAssetId === asset.id : undefined,
    personGalleryLinked: !isWork(subject) ? subject.galleryAssetIds.includes(asset.id) : undefined,
    state: "pending",
    deletedAt: now,
    updatedAt: now,
  };
  await repository.saveAssetDeletionReceipt(receipt);

  try {
    await saveWithoutAsset(repository, subject, asset.id);
    await repository.deletePrivateAsset(asset.id);
    const completed = { ...receipt, state: "deleted" as const, updatedAt: new Date().toISOString() };
    await repository.saveAssetDeletionReceipt(completed);
    return completed;
  } catch (error) {
    // deletePrivateAsset 可能已经成功而最终 Receipt 更新失败；先补回 Asset，
    // 再补回主体引用，才能避免制造“引用存在但图片记录消失”的悬空关系。
    await repository.saveAsset(asset).catch(() => undefined);
    await saveSubject(repository, subject).catch(() => undefined);
    await repository.saveAssetDeletionReceipt({
      ...receipt,
      state: "failed",
      updatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
    throw error;
  }
}

/** 恢复时基于“当前主体”合并引用，避免整份 before-image 覆盖用户删除后的其它编辑。 */
export async function restoreRecycledAsset(
  repository: TauriLibraryRepository,
  receipt: AssetDeletionReceipt,
): Promise<void> {
  if (receipt.state !== "deleted") throw new Error("该图片回收记录当前不可恢复。");
  const subject = receipt.subjectType === "work"
    ? await repository.findWorkById(receipt.subjectId)
    : await repository.findPersonById(receipt.subjectId);
  if (!subject) throw new Error("原作品或人物已经不存在，无法自动恢复图片关联。");

  await repository.saveAsset(receipt.asset);
  try {
    await saveWithRestoredAsset(repository, subject, receipt);
  } catch (error) {
    await repository.deletePrivateAsset(receipt.asset.id).catch(() => undefined);
    throw error;
  }
  const restoredAt = new Date().toISOString();
  await repository.saveAssetDeletionReceipt({ ...receipt, state: "restored", restoredAt, updatedAt: restoredAt });
}

export async function latestRecycledAsset(
  repository: TauriLibraryRepository,
  subjectType: "work" | "person",
  subjectId: string,
): Promise<AssetDeletionReceipt | undefined> {
  return (await repository.listAssetDeletionReceipts())
    .filter((item) => item.subjectType === subjectType && item.subjectId === subjectId && item.state === "deleted")
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))[0];
}

function isWork(subject: AssetSubject): subject is Work {
  return "code" in subject;
}

function saveSubject(repository: TauriLibraryRepository, subject: AssetSubject): Promise<void> {
  return isWork(subject) ? repository.saveWork(subject) : repository.savePerson(subject);
}

function saveWithoutAsset(repository: TauriLibraryRepository, subject: AssetSubject, assetId: string): Promise<void> {
  const updatedAt = new Date().toISOString();
  return isWork(subject)
    ? repository.saveWork({ ...subject, assetIds: subject.assetIds.filter((id) => id !== assetId), updatedAt })
    : repository.savePerson({
      ...subject,
      portraitAssetId: subject.portraitAssetId === assetId ? undefined : subject.portraitAssetId,
      galleryAssetIds: subject.galleryAssetIds.filter((id) => id !== assetId),
      updatedAt,
    });
}

function saveWithRestoredAsset(repository: TauriLibraryRepository, subject: AssetSubject, receipt: AssetDeletionReceipt): Promise<void> {
  const updatedAt = new Date().toISOString();
  if (isWork(subject)) {
    return repository.saveWork({
      ...subject,
      assetIds: receipt.workAssetLinked ? [...new Set([...subject.assetIds, receipt.asset.id])] : subject.assetIds,
      updatedAt,
    });
  }
  return repository.savePerson({
    ...subject,
    portraitAssetId: receipt.personPortraitLinked ? receipt.asset.id : subject.portraitAssetId,
    galleryAssetIds: receipt.personGalleryLinked ? [...new Set([...subject.galleryAssetIds, receipt.asset.id])] : subject.galleryAssetIds,
    updatedAt,
  });
}
