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
  appConfigDir: string;
  appLocalDataDir: string;
  settingsPath: string;
}

export interface DesktopBootstrapSettings {
  schemaVersion: 1;
  libraryPath?: string;
  mediaScanPaths: string[];
  nfoScanPaths: string[];
  sharedPackPaths: string[];
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
