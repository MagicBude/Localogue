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




export interface DesktopAssetStorageEntry {
  storagePath: string;
  fileSize: number;
}

export interface DesktopAssetStorageHealth {
  assetRecords: number;
  managedReferences: number;
  storedFiles: number;
  orphanFiles: DesktopAssetStorageEntry[];
  missingFiles: string[];
  unmanagedReferences: string[];
  reclaimableBytes: number;
}

export interface DesktopAssetStorageCleanupResult {
  deletedFiles: number;
  reclaimedBytes: number;
  skippedFiles: number;
}

export interface DesktopPortableFile {
  path: string;
  bytes: number[] | Uint8Array;
}

export interface DesktopPortableFileDigest {
  path: string;
  sha256: string;
  size: number;
}

export type DesktopPortableFileStatus = "new" | "identical" | "conflict";

export interface DesktopPortableCategoryCount {
  newFiles: number;
  identicalFiles: number;
  conflictFiles: number;
}

export interface DesktopPortablePlanEntry {
  path: string;
  category: string;
  status: DesktopPortableFileStatus;
  existingSize?: number;
}

export interface DesktopPortablePrivatePreview {
  targetLibraryPath: string;
  newFiles: number;
  identicalFiles: number;
  conflictFiles: number;
  categories: Record<string, DesktopPortableCategoryCount>;
  entries: DesktopPortablePlanEntry[];
}

export interface DesktopPortableImportResult {
  imported: number;
  skipped: number;
  skippedIdentical?: number;
  skippedConflicts?: number;
  importedByCategory?: Record<string, number>;
  skippedByCategory?: Record<string, number>;
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
