/**
 * Localogue 实例级设置。
 *
 * 这里保存的是“这台 Localogue 实例怎么运行”，而不是某个 Work / Person 的业务数据。
 * 因此它不会进入 Canonical Library，也不会跟随 Community Pack 分享。
 */
export interface InstanceSettings {
  schemaVersion: 1;
  /** 私人 Canonical Library 路径；为空时只读共享资料或 Demo。 */
  libraryPath?: string;
  /**
   * 只读共享资料包目录，按数组顺序决定优先级。
   * 本地私人 Library 永远排在它们之前。
   */
  sharedPackPaths: string[];
  /** 本地媒体扫描目录；MediaFile 永远属于私人层。 */
  mediaScanPaths?: string[];
  /** 独立 NFO 元数据目录；不要求与视频目录重合或相邻。 */
  nfoScanPaths?: string[];
  /** ffprobe 可执行文件。为空时使用 PATH 中的 ffprobe。 */
  ffprobePath?: string;
  updatedAt?: string;
}

export type PrivateLibraryPathSource = "environment" | "settings" | null;
