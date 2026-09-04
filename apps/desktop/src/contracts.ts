/**
 * Desktop Webview 不自行复制 Runtime Contract。
 * 这里用 type-only re-export 直接复用主项目 Application 层的纯数据协议。
 */
export type {
  DesktopBootstrapSettings,
  DesktopLibraryProfile,
  DesktopExampleLibraryInfo,
  DesktopMediaProbeRequest,
  DesktopMediaProbeResult,
  DesktopRuntimeInfo,
  DesktopSharedPackInfo,
  DesktopTaskProgress,
  DesktopTaskStage,
} from "../../../src/application/platform/desktop-runtime-contract";

export interface DesktopFileStat {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

export interface DesktopFileEntry {
  path: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt: string;
}


export interface DesktopImportedAssetFile {
  storagePath: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
}


export interface DesktopPortableFile {
  path: string;
  bytes: number[] | Uint8Array;
}

export interface DesktopPortableImportResult {
  imported: number;
  skipped: number;
}
export type DesktopWritableLibraryCollection =
  | "works"
  | "people"
  | "organizations"
  | "series"
  | "genres"
  | "tags"
  | "assets"
  | "media-files";



export type DesktopPrivateAuditCollection =
  | "evidence"
  | "evidence-lifecycle"
  | "review-commits"
  | "snapshots"
  | "restore-receipts"
  | "provenance"
  | "media-binding-receipts";

export type DesktopDeletableLibraryCollection =
  | "works"
  | "people"
  | "genres"
  | "tags"
  | "assets"
  | "media-files";

export type DesktopLibraryCollection =
  | "works"
  | "people"
  | "organizations"
  | "series"
  | "genres"
  | "tags"
  | "assets"
  | "media-files";
