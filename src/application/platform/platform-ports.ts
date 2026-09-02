/**
 * Localogue 的平台能力边界。
 *
 * Application 层只依赖这些接口，不应该直接 import node:fs / node:path / child_process。
 * V1-12 先提供 Node/Web Adapter；V1-13 接 Tauri 时，实现新的 Adapter 即可复用扫描业务逻辑。
 */
export interface PlatformFileEntry {
  path: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt: string;
}

export interface PlatformFileStat {
  path: string;
  size: number;
  modifiedAt: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface WalkFilesOptions {
  extensions?: string[];
  includeHidden?: boolean;
  maxFiles?: number;
  signal?: AbortSignal;
}

export interface FileSystemPort {
  resolvePath(input: string): string;
  basename(filePath: string, extensionToStrip?: string): string;
  dirname(filePath: string): string;
  extname(filePath: string): string;
  normalizePathForIdentity(filePath: string): string;
  samePath(a: string, b: string): boolean;
  isInside(root: string, filePath: string): boolean;
  stat(filePath: string, signal?: AbortSignal): Promise<PlatformFileStat>;
  exists(filePath: string, signal?: AbortSignal): Promise<boolean>;
  walkFiles(root: string, options?: WalkFilesOptions): Promise<PlatformFileEntry[]>;
}

export interface MediaProbeResult {
  durationSeconds?: number;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  container?: string;
}

export interface MediaProbePort {
  probe(executable: string, filePath: string, signal?: AbortSignal): Promise<MediaProbeResult>;
  isExecutableMissing(error: unknown): boolean;
}

export interface FileHashPort {
  sha256Text(value: string): string;
  sha256File(filePath: string, signal?: AbortSignal): Promise<string>;
}

/**
 * V1-12 先冻结原生文件选择接口；Web Adapter 明确不支持。
 * V1-13 Tauri Desktop 会提供真正的系统目录选择器。
 */
export interface FileDialogPort {
  readonly supported: boolean;
  pickDirectory(): Promise<string | null>;
  pickFile(options?: { extensions?: string[] }): Promise<string | null>;
}

/**
 * 打开媒体和在资源管理器/Finder 中定位文件也属于平台能力。
 * 业务层不应该自己 spawn explorer.exe / open / xdg-open。
 */
export interface FileOpenerPort {
  readonly supported: boolean;
  openPath(filePath: string): Promise<void>;
  revealInFolder(filePath: string): Promise<void>;
}

export interface PlatformCapabilities {
  runtime: "web-node" | "tauri";
  nativeFolderPicker: boolean;
  nativeFilePicker: boolean;
  openPath: boolean;
  revealInFolder: boolean;
  backgroundMediaScan: boolean;
  cancellableMediaScan: boolean;
}

export interface PlatformServices {
  fileSystem: FileSystemPort;
  mediaProbe: MediaProbePort;
  fileHash: FileHashPort;
  fileDialog: FileDialogPort;
  fileOpener: FileOpenerPort;
  capabilities: PlatformCapabilities;
}
