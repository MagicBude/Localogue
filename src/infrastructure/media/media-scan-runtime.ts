import { MediaScanCoordinator } from "@/application/media/media-scan-coordinator";
import {
  createMediaScanRequestFromSettings,
  type MediaScanOptions,
} from "@/application/media/media-scan-service";
import type { MediaScanJobSnapshot } from "@/domain/entities/media-scan";
import { nodeWebPlatform } from "@/infrastructure/platform/node-platform-provider";
import { libraryRepository } from "@/infrastructure/repositories/repository-provider";
import { readInstanceSettings } from "@/infrastructure/settings/instance-settings-store";

type GlobalWithMediaScan = typeof globalThis & {
  __localogueMediaScanCoordinator?: MediaScanCoordinator;
};

const runtimeGlobal = globalThis as GlobalWithMediaScan;

/**
 * 本地 Next.js Server 是长驻进程，因此 V1-12 用进程内 Coordinator 即可。
 * globalThis 可以降低开发模式热更新时重复创建 Coordinator 的概率。
 * 真正跨进程/持久任务队列留到后续 Desktop/Worker 阶段。
 */
export const mediaScanCoordinator = runtimeGlobal.__localogueMediaScanCoordinator
  ?? new MediaScanCoordinator(libraryRepository, nodeWebPlatform);

runtimeGlobal.__localogueMediaScanCoordinator = mediaScanCoordinator;

export function startConfiguredMediaScan(options: MediaScanOptions = {}): MediaScanJobSnapshot {
  const request = createMediaScanRequestFromSettings(readInstanceSettings(), nodeWebPlatform, options);
  return mediaScanCoordinator.start(request);
}
