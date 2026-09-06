import type { MediaScanJobSnapshot } from "./media-scan";

/**
 * 一轮媒体扫描结束后的 Private 审计记录。
 *
 * Snapshot 本身已经包含选项、结果、警告和错误；Receipt 只补充稳定 Schema 与耗时，
 * 不复制另一套统计字段，避免 Coordinator 与历史页对“扫描结果”产生不同定义。
 */
export interface MediaScanHistoryEntry {
  schemaVersion: 1;
  id: string;
  snapshot: MediaScanJobSnapshot;
  durationMs: number;
  recordedAt: string;
}
