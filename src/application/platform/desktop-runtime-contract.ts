/**
 * Web / Desktop 都可以理解的 Tauri Runtime Contract。
 *
 * 这里刻意只放纯数据结构：不 import @tauri-apps，也不 import Node。
 * V1-15 继续用它约束 Webview 与 Rust Command/Event 之间的数据形状。
 */
export interface DesktopRuntimeInfo {
  runtime: "tauri";
  productName: string;
  version: string;
  identifier: string;
  environment: "development" | "production";
  /** Native IPC / ACL contract revision. Missing means an older runtime is still running. */
  contractRevision?: number;
  appConfigDir: string;
  appLocalDataDir: string;
  settingsPath: string;
}


export interface DesktopLibraryProfile {
  id: string;
  name: string;
  description?: string;
  libraryPath?: string;
  libraryRoots: string[];
  mediaScanPaths: string[];
  nfoScanPaths: string[];
  sharedPackPaths: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DesktopExampleLibraryInfo {
  libraryPath: string;
  sharedPackPath?: string;
  created: boolean;
}

export interface DesktopBootstrapSettings {
  schemaVersion: 1;
  libraryPath?: string;
  /** Unified Library Roots：一次配置即可递归发现视频、NFO、本地海报/封面等资料。 */
  libraryRoots: string[];
  /** 兼容/高级媒体专用路径；与 libraryRoots 合并扫描。 */
  mediaScanPaths: string[];
  nfoScanPaths: string[];
  sharedPackPaths: string[];
  /** Desktop 本机资料库配置预设；切换时整组替换路径字段，不复制 Canonical 数据。 */
  libraryProfiles?: DesktopLibraryProfile[];
  activeLibraryProfileId?: string;
  ffprobePath?: string;
  webUrl: string;
  updatedAt?: string;
}

export interface DesktopMediaProbeRequest {
  executable: string;
  filePath: string;
}

export interface DesktopMediaProbeResult {
  durationSeconds?: number;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  container?: string;
}

export type DesktopTaskStage = "preparing" | "probing" | "completed" | "failed";

export interface DesktopTaskProgress {
  taskId: string;
  taskType: "media-probe";
  stage: DesktopTaskStage;
  message: string;
  currentPath?: string;
}

export interface DesktopSharedPackInfo {
  configuredPath: string;
  absolutePath: string;
  libraryPath?: string;
  valid: boolean;
  id?: string;
  name?: string;
  version?: string;
  description?: string;
  license?: string;
  error?: string;
}
