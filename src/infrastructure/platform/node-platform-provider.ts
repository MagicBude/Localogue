import type { PlatformServices } from "@/application/platform/platform-ports";
import {
  NodeFileHashAdapter,
  NodeFileSystemAdapter,
  NodeMediaProbeAdapter,
  UnsupportedWebFileDialogAdapter,
  UnsupportedWebFileOpenerAdapter,
} from "@/infrastructure/platform/node-platform-adapters";

/**
 * 当前 Next.js Web Runtime 的平台能力集合。
 *
 * V1-13 会新增 TauriPlatformServices；Application 层扫描器不需要因此重写。
 */
export const nodeWebPlatform: PlatformServices = {
  fileSystem: new NodeFileSystemAdapter(process.cwd()),
  mediaProbe: new NodeMediaProbeAdapter(),
  fileHash: new NodeFileHashAdapter(),
  fileDialog: new UnsupportedWebFileDialogAdapter(),
  fileOpener: new UnsupportedWebFileOpenerAdapter(),
  capabilities: {
    runtime: "web-node",
    nativeFolderPicker: false,
    nativeFilePicker: false,
    openPath: false,
    revealInFolder: false,
    backgroundMediaScan: true,
    cancellableMediaScan: true,
  },
};
