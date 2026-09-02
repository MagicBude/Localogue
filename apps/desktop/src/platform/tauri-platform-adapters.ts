import type {
  FileDialogPort,
  FileOpenerPort,
  MediaProbePort,
  MediaProbeResult,
  PlatformCapabilities,
} from "../../../../src/application/platform/platform-ports";

import { desktopBridge } from "../tauri-bridge";

/**
 * V1-13 首批真正落地的 Tauri Platform Adapter。
 *
 * FileSystemPort / FileHashPort 仍由 V1-14 继续接入，因为当前 Desktop Alpha
 * 还没有把完整 MediaScanService 搬进 Webview Runtime；这里先完成最有价值的
 * Native Dialog / Open / Reveal / ffprobe 垂直链路。
 */
export class TauriFileDialogAdapter implements FileDialogPort {
  readonly supported = true;

  pickDirectory(): Promise<string | null> {
    return desktopBridge.pickDirectory();
  }

  pickFile(): Promise<string | null> {
    return desktopBridge.pickMediaFile();
  }
}

export class TauriFileOpenerAdapter implements FileOpenerPort {
  readonly supported = true;

  openPath(filePath: string): Promise<void> {
    return desktopBridge.openPath(filePath);
  }

  revealInFolder(filePath: string): Promise<void> {
    return desktopBridge.revealInFolder(filePath);
  }
}

export class TauriMediaProbeAdapter implements MediaProbePort {
  async probe(executable: string, filePath: string): Promise<MediaProbeResult> {
    return desktopBridge.probeMedia(executable, filePath);
  }

  isExecutableMissing(error: unknown): boolean {
    return String(error).toLowerCase().includes("ffprobe") && (
      String(error).toLowerCase().includes("not found") ||
      String(error).toLowerCase().includes("cannot find") ||
      String(error).includes("找不到") ||
      String(error).includes("无法启动")
    );
  }
}

export const tauriDesktopCapabilities: PlatformCapabilities = {
  runtime: "tauri",
  nativeFolderPicker: true,
  nativeFilePicker: true,
  openPath: true,
  revealInFolder: true,
  backgroundMediaScan: false,
  cancellableMediaScan: false,
};
