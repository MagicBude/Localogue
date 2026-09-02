export interface MediaSidecarObservation {
  /** 与视频同目录或同基名关联的 NFO。它只是 Evidence 候选，不直接成为 Canonical 真相。 */
  nfoPaths: string[];
  /** poster / cover / ps 等封面候选。它们只是 Asset 候选。 */
  posterPaths: string[];
  /** fanart / background / pl / extrafanart 等背景图候选。 */
  fanartPaths: string[];
}

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
  /**
   * 当视频文件改变但本轮没有成功重新 ffprobe 时为 true。
   * 这可以避免把旧分辨率/Codec 悄悄当成当前真实值。
   */
  analysisStale?: boolean;
  /** 本地同目录伴随文件观察，不会自动写入 Work / Person。 */
  sidecars?: MediaSidecarObservation;
  analyzedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
