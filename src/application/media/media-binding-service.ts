import type { MediaBindingCandidate, MediaBindingReceipt } from "@/domain/entities/media-binding";
import type { MediaFile } from "@/domain/entities/media-file";
import type { Work } from "@/domain/entities/work";
import type { LibraryRepository } from "@/domain/repositories/library-repository";
import { saveMediaBindingReceipt } from "@/infrastructure/media/media-binding-receipt-store";

export async function listMediaBindingCandidates(
  repository: LibraryRepository,
  mediaFileId: string,
  query?: string,
): Promise<MediaBindingCandidate[]> {
  const media = await repository.findMediaFileById(mediaFileId);
  if (!media) throw new Error(`MediaFile 不存在：${mediaFileId}`);

  const trimmed = query?.trim();
  if (trimmed) {
    const result = await repository.listWorks({ text: trimmed, page: 1, pageSize: 50 });
    return result.items.map((work) => ({
      workId: work.id,
      code: work.code,
      title: work.titles.ja ?? work.titles["zh-CN"] ?? work.titles.en ?? work.code,
      score: scoreWorkForMedia(media, work),
      reasons: buildReasons(media, work),
    })).sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  }

  const all = await repository.listWorks({ page: 1, pageSize: 100000 });
  return all.items
    .map((work) => ({ work, score: scoreWorkForMedia(media, work), reasons: buildReasons(media, work) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.work.code.localeCompare(b.work.code))
    .slice(0, 20)
    .map(({ work, score, reasons }) => ({
      workId: work.id,
      code: work.code,
      title: work.titles.ja ?? work.titles["zh-CN"] ?? work.titles.en ?? work.code,
      score,
      reasons,
    }));
}

export async function updateMediaBinding(
  repository: LibraryRepository,
  mediaFileId: string,
  nextWorkId: string | null,
): Promise<{ mediaFile: MediaFile; receipt: MediaBindingReceipt | null }> {
  const media = await repository.findMediaFileById(mediaFileId);
  if (!media) throw new Error(`MediaFile 不存在：${mediaFileId}`);

  const normalizedWorkId = nextWorkId?.trim() || undefined;
  if (normalizedWorkId) {
    const work = await repository.findWorkById(normalizedWorkId);
    if (!work) throw new Error(`Work 不存在：${normalizedWorkId}`);
  }

  if (media.workId === normalizedWorkId) return { mediaFile: media, receipt: null };

  const before = media.workId;
  const updated: MediaFile = {
    ...media,
    ...(normalizedWorkId ? { workId: normalizedWorkId, matchMethod: "manual" as const } : {}),
    updatedAt: new Date().toISOString(),
  };
  if (!normalizedWorkId) {
    delete updated.workId;
    delete updated.matchMethod;
  }

  await repository.saveMediaFile(updated);
  try {
    const receipt = await saveMediaBindingReceipt({
      mediaFileId,
      mediaFilePath: media.path,
      ...(before ? { beforeWorkId: before } : {}),
      ...(normalizedWorkId ? { afterWorkId: normalizedWorkId } : {}),
      action: before && normalizedWorkId ? "rebind" : normalizedWorkId ? "bind" : "unbind",
    });
    return { mediaFile: updated, receipt };
  } catch (error) {
    // V1 JSON 没有事务：如果审计 Receipt 保存失败，尽量恢复原来的 MediaFile 绑定状态。
    await repository.saveMediaFile(media);
    throw error;
  }
}

function scoreWorkForMedia(media: MediaFile, work: Work): number {
  const base = normalizeText(media.fileName.replace(/\.[^.]+$/, ""));
  const code = normalizeText(work.code);
  const title = normalizeText(work.titles.ja ?? "");
  let score = 0;
  if (code && base.includes(code)) score += 100;
  if (title && title.length >= 6 && base.includes(title)) score += 45;
  return score;
}

function buildReasons(media: MediaFile, work: Work): string[] {
  const reasons: string[] = [];
  const base = normalizeText(media.fileName.replace(/\.[^.]+$/, ""));
  const code = normalizeText(work.code);
  const title = normalizeText(work.titles.ja ?? "");
  if (code && base.includes(code)) reasons.push("文件名包含规范化番号");
  if (title && title.length >= 6 && base.includes(title)) reasons.push("文件名包含规范化日文标题");
  return reasons;
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
}
