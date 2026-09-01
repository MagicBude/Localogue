/**
 * MediaFile 是本地媒体文件，不等同于 Work。
 * V1 先保留模型，后续目录扫描/ffprobe 再逐步补充字段。
 */
export interface MediaFile {
  schemaVersion: number;
  id: string;
  workId: string;
  path: string;
  fileName: string;
  fileSize?: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  codec?: string;
  sha256?: string;
}
