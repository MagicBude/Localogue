import type { PlatformServices } from "@/application/platform/platform-ports";
import { scanMediaLibrary, type MediaScanRequest } from "@/application/media/media-scan-service";
import type { MediaScanJobSnapshot, MediaScanProgress } from "@/domain/entities/media-scan";
import type { LibraryRepository } from "@/domain/repositories/library-repository";

/**
 * 单实例扫描协调器。
 *
 * 它解决两个问题：
 * 1. 防止用户连续点击按钮同时启动多轮 ffprobe / Hash；
 * 2. 把长扫描从单个 HTTP 请求中拆出来，让 Web UI 可以轮询进度并取消。
 *
 * V1-13 Tauri 可以把同一状态模型改成 Rust command/event，而 UI 不需要重新发明扫描生命周期。
 */
export class MediaScanCoordinator {
  private snapshot: MediaScanJobSnapshot | null = null;
  private abortController: AbortController | null = null;
  private completion: Promise<void> | null = null;

  constructor(
    private readonly repository: LibraryRepository,
    private readonly platform: PlatformServices,
  ) {}

  start(request: MediaScanRequest): MediaScanJobSnapshot {
    if (this.snapshot?.status === "running" || this.snapshot?.status === "cancelling") {
      throw new Error("已经有一轮媒体扫描正在运行；请等待完成或先取消当前扫描。");
    }

    const now = new Date().toISOString();
    this.abortController = new AbortController();
    this.snapshot = {
      id: createJobId(),
      status: "running",
      startedAt: now,
      progress: {
        phase: "preparing",
        current: 0,
        total: 0,
        message: "准备媒体扫描",
      },
      options: {
        probeMedia: request.probeMedia !== false,
        computeSha256: Boolean(request.computeSha256),
        pruneMissing: request.pruneMissing !== false,
      },
    };

    this.completion = this.execute(request, this.abortController.signal);
    void this.completion;
    return cloneSnapshot(this.snapshot);
  }

  cancel(): MediaScanJobSnapshot | null {
    if (!this.snapshot || this.snapshot.status !== "running") return this.getSnapshot();
    this.snapshot.status = "cancelling";
    this.snapshot.progress = {
      ...this.snapshot.progress,
      message: "正在取消媒体扫描…",
    };
    this.abortController?.abort();
    return this.getSnapshot();
  }

  getSnapshot(): MediaScanJobSnapshot | null {
    return this.snapshot ? cloneSnapshot(this.snapshot) : null;
  }

  /**
   * 等待当前扫描真正结束。
   *
   * Web 的轮询 UI 可以继续只使用 getSnapshot；Desktop 的“一键同步”则需要
   * 等所有扫描根目录完成后再向用户报告同步结束，避免多个额外媒体目录时
   * 第一个目录完成后看起来像整轮任务已经结束。
   */
  async waitForCompletion(): Promise<MediaScanJobSnapshot | null> {
    await this.completion;
    return this.getSnapshot();
  }

  private async execute(request: MediaScanRequest, signal: AbortSignal): Promise<void> {
    try {
      const result = await scanMediaLibrary(this.repository, request, this.platform, {
        signal,
        onProgress: (progress) => this.updateProgress(progress),
      });
      if (!this.snapshot) return;
      this.snapshot = {
        ...this.snapshot,
        status: "completed",
        finishedAt: new Date().toISOString(),
        progress: {
          phase: "completed",
          current: result.discovered,
          total: result.discovered,
          message: "媒体增量扫描完成",
        },
        result,
      };
    } catch (error) {
      if (!this.snapshot) return;
      const finishedAt = new Date().toISOString();
      if (isAbortError(error)) {
        this.snapshot = {
          ...this.snapshot,
          status: "cancelled",
          finishedAt,
          progress: {
            ...this.snapshot.progress,
            message: "媒体扫描已取消；已经完成的安全写入会保留，下次增量扫描会继续收敛。",
          },
        };
      } else {
        this.snapshot = {
          ...this.snapshot,
          status: "failed",
          finishedAt,
          error: message(error),
          progress: {
            ...this.snapshot.progress,
            message: "媒体扫描失败",
          },
        };
      }
    } finally {
      this.abortController = null;
      this.completion = null;
    }
  }

  private updateProgress(progress: MediaScanProgress): void {
    if (!this.snapshot) return;
    this.snapshot = { ...this.snapshot, progress };
  }
}

function createJobId(): string {
  const random = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `scan_${random}`;
}

function cloneSnapshot(snapshot: MediaScanJobSnapshot): MediaScanJobSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as MediaScanJobSnapshot;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || /取消|aborted/i.test(error.message));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
