/**
 * MediaFile 表示“这台 Localogue 能访问到的本地媒体文件”。
 *
 * 它属于 Private Layer，而不是 Community Work 的公共事实。
 * 因此 workId 可以为空：刚扫描出来、尚未识别的文件仍然应该被记录和治理。
 */
export interface MediaFile {
  schemaVersion: number;
  id: string;
  workId?: string;
  path: string;
  fileName: string;
  extension?: string;
  fileSize?: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  container?: string;
  sha256?: string;
  scanRoot?: string;
  matchMethod?: "code" | "manual";
  fileModifiedAt?: string;
  analyzedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
