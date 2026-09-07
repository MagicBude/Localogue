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
  /**
   * 统一资料源根目录。一个根目录可以同时包含视频、NFO、海报/封面等子目录；
   * Application 层按文件类型分类发现，而不是要求这些文件相邻。
   */
  libraryRoots?: string[];
  /** 高级/兼容媒体扫描目录；MediaFile 永远属于私人层。 */
  mediaScanPaths?: string[];
  /** 高级/兼容 NFO 元数据目录；不要求与视频目录重合或相邻。 */
  nfoScanPaths?: string[];
  /** ffprobe 可执行文件。为空时使用 PATH 中的 ffprobe。 */
  ffprobePath?: string;
  /**
   * 多资料库配置：每个 Profile 是一组独立的资料源预设（私人 Library / 统一根目录 / 共享包）。
   * 引入自 V1-24A 的 Library Profile 模型，网页端现已与桌面端对齐。
   * 平面字段（libraryPath / libraryRoots …）始终等于当前激活 Profile，便于旧代码继续直接读取。
   */
  libraryProfiles?: import("./library-profile").LibraryProfile[];
  /** 当前激活的 Profile ID；缺失时回退到 libraryProfiles 的第一个。 */
  activeLibraryProfileId?: string;
  updatedAt?: string;
}

export type PrivateLibraryPathSource = "environment" | "settings" | null;
