import { access, mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";

import type { LibraryRepository } from "@/domain/repositories/library-repository";
import { getConfiguredPrivateLibraryPath } from "@/infrastructure/repositories/library-path";
import { readInstanceSettings } from "@/infrastructure/settings/instance-settings-store";
import { NodeFrameAdapter } from "@/infrastructure/platform/node-platform-adapters";
import { uploadPrivateAsset } from "@/application/assets/asset-upload-service";
import {
  getPresentationPreference,
  makePresentationPreferenceId,
  savePresentationPreference,
} from "@/infrastructure/presentation/presentation-preference-store";

/**
 * 本地封面抽帧：从作品可读取的本地视频中截一帧，作为该作品的“私人封面偏好”。
 *
 * 设计要点（与项目治理原则一致）：
 * - 抽出来的帧只进 Private Library 的 Asset，并通过 PresentationPreference
 *   的 preferredCoverAssetId 指向它；绝不修改 Canonical Work 本体，也不进 Shared Pack。
 * - 这是服务端能力（Next.js nodejs runtime），因此这里直接使用 node:fs 读取临时抽帧结果；
 *   它不属于 V1-12 冻结的“媒体扫描业务核心”，不违反平台边界校验。
 * - 任何一步不可用时都返回结构化失败原因，由 UI 友好提示，而不是抛错中断。
 */

export type CoverFrameFailure =
  | "no-private-library"
  | "no-media"
  | "media-unreadable"
  | "ffmpeg-missing"
  | "extract-failed";

export interface CoverFrameResult {
  ok: boolean;
  assetId?: string;
  reason?: CoverFrameFailure;
  message?: string;
}

const frameAdapter = new NodeFrameAdapter();

export async function generateWorkCoverFrame(
  repository: LibraryRepository,
  workId: string,
  options: { timeSeconds?: number } = {},
): Promise<CoverFrameResult> {
  const privateRoot = getConfiguredPrivateLibraryPath();
  if (!privateRoot) {
    return {
      ok: false,
      reason: "no-private-library",
      message: "请先在设置中配置可写的 Private Library，才能保存抽帧封面。",
    };
  }

  const mediaFiles = await repository.listMediaFiles(workId);
  const videoPath = await pickReadableVideo(mediaFiles);
  if (!videoPath) {
    return {
      ok: false,
      reason: "no-media",
      message: "当前作品没有可读取的本地视频文件：可能尚未扫描到媒体文件，或文件已不在原路径。",
    };
  }

  // 默认在第 5 秒抽帧；用户可在接入时覆盖。保留一点片头避免黑屏/版权卡。
  const timeSeconds = typeof options.timeSeconds === "number" && Number.isFinite(options.timeSeconds) && options.timeSeconds >= 0
    ? options.timeSeconds
    : 5;
  const executable = readInstanceSettings().ffmpegPath?.trim() || "ffmpeg";
  const cacheDir = path.join(privateRoot, ".cache", "cover-frame");
  await mkdir(cacheDir, { recursive: true });
  const outputPath = path.join(cacheDir, `${workId}-${Date.now()}.jpg`);

  try {
    await frameAdapter.extractFrame(executable, videoPath, outputPath, { timeSeconds });
  } catch (error) {
    if (frameAdapter.isExecutableMissing(error)) {
      return {
        ok: false,
        reason: "ffmpeg-missing",
        message: "未检测到 ffmpeg。请在设置页填写 ffmpeg 可执行文件路径后重试。",
      };
    }
    return {
      ok: false,
      reason: "extract-failed",
      message: `抽帧失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }

  let bytes: Uint8Array;
  try {
    bytes = await readFile(outputPath);
  } catch {
    return {
      ok: false,
      reason: "media-unreadable",
      message: "抽帧命令已执行，但无法读取生成的封面图片。",
    };
  } finally {
    await unlink(outputPath).catch(() => undefined);
  }

  const asset = await uploadPrivateAsset({
    repository,
    subjectType: "work",
    subjectId: workId,
    type: "poster",
    fileName: `${workId}-cover-frame.jpg`,
    mimeType: "image/jpeg",
    bytes,
  });

  // 合并既有偏好（收藏 / 评分 / 头像），只更新封面，避免覆盖用户其它私人设置。
  const existing = await getPresentationPreference("work", workId);
  const merged = {
    ...(existing ?? {
      schemaVersion: 1 as const,
      id: makePresentationPreferenceId("work", workId),
      entityType: "work" as const,
      entityId: workId,
    }),
    preferredCoverAssetId: asset.id,
    updatedAt: new Date().toISOString(),
  };
  await savePresentationPreference(merged);

  return { ok: true, assetId: asset.id };
}

/**
 * 按记录顺序找到第一个“当前机器上真实存在、可读”的视频文件。
 * MediaFile.path 可能是导入时登记的旧路径，文件已移动/卸载时 access 会失败，需跳过。
 */
async function pickReadableVideo(mediaFiles: { path?: string }[]): Promise<string | null> {
  for (const file of mediaFiles) {
    if (!file.path) continue;
    try {
      await access(file.path);
      return file.path;
    } catch {
      // 该路径不可读，尝试下一个媒体文件。
    }
  }
  return null;
}
