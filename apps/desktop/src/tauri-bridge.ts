import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  DesktopBootstrapSettings,
  DesktopMediaProbeResult,
  DesktopRuntimeInfo,
  DesktopTaskProgress,
  DesktopFileEntry,
  DesktopImportedAssetFile,
  DesktopPortableFile,
  DesktopPortableImportResult,
  DesktopFileStat,
  DesktopDeletableLibraryCollection,
  DesktopLibraryCollection,
  DesktopPrivateAuditCollection,
  DesktopWritableLibraryCollection,
  DesktopSharedPackInfo,
} from "./contracts";

const PROGRESS_EVENT = "localogue://desktop-task-progress";

export const desktopBridge = {
  runtimeInfo: () => invoke<DesktopRuntimeInfo>("get_runtime_info"),
  loadSettings: () => invoke<DesktopBootstrapSettings>("load_desktop_settings"),
  saveSettings: (settings: DesktopBootstrapSettings) =>
    invoke<DesktopBootstrapSettings>("save_desktop_settings", { settings }),
  pickDirectory: () => invoke<string | null>("pick_directory"),
  pickMediaFile: () => invoke<string | null>("pick_media_file"),
  pickPortablePackFile: () => invoke<string | null>("pick_portable_pack_file"),
  readPortablePackFile: (path: string) => invoke<ArrayBuffer>("read_portable_pack_file", { path }),
  savePortablePackFile: (suggestedName: string, bytes: Uint8Array) =>
    invoke<string | null>("save_portable_pack_file", { suggestedName, bytes: Array.from(bytes) }),
  collectPrivatePortableFiles: () => invoke<DesktopPortableFile[]>("collect_private_portable_files"),
  importPrivatePortableFiles: (files: DesktopPortableFile[]) => invoke<DesktopPortableImportResult>("import_private_portable_files", { files: files.map((file) => ({ ...file, bytes: Array.from(file.bytes) })) }),
  collectSharedPortableFiles: (packPath: string) => invoke<DesktopPortableFile[]>("collect_shared_portable_files", { packPath }),
  installSharedPortableFiles: (sourceId: string, sourceVersion: string, files: DesktopPortableFile[]) => invoke<string>("install_shared_portable_files", { sourceId, sourceVersion, files: files.map((file) => ({ ...file, bytes: Array.from(file.bytes) })) }),
  openPath: (path: string) => invoke<void>("open_path", { path }),
  revealInFolder: (path: string) => invoke<void>("reveal_in_folder", { path }),
  openWebUrl: (url: string) => invoke<void>("open_web_url", { url }),
  probeMedia: (executable: string, filePath: string) =>
    invoke<DesktopMediaProbeResult>("probe_media", { request: { executable, filePath } }),
  resolvePath: (path: string) => invoke<string>("resolve_path", { path }),
  statPath: (path: string) => invoke<DesktopFileStat>("stat_path", { path }),
  pathExists: (path: string) => invoke<boolean>("path_exists", { path }),
  walkFiles: (request: { root: string; extensions?: string[]; includeHidden?: boolean; maxFiles?: number }) =>
    invoke<DesktopFileEntry[]>("walk_files", { request }),
  readNfoText: (path: string) => invoke<string>("read_nfo_text", { path }),
  importPrivateAssetFile: (path: string) => invoke<DesktopImportedAssetFile>("import_private_asset_file", { path }),
  readPrivateAssetBytes: (storagePath: string) => invoke<ArrayBuffer>("read_private_asset_bytes", { storagePath }),
  sha256File: (path: string) => invoke<string>("sha256_file", { path }),
  inspectSharedPack: (packPath: string) =>
    invoke<DesktopSharedPackInfo>("inspect_shared_pack", { packPath }),
  readLibraryCollection: <T>(libraryPath: string, collection: DesktopLibraryCollection) =>
    invoke<T[]>("read_library_collection", { libraryPath, collection }),
  writeLibraryEntity: (collection: DesktopWritableLibraryCollection, entity: unknown) =>
    invoke<void>("write_library_entity", { collection, entity }),
  readPrivateAuditCollection: <T>(collection: DesktopPrivateAuditCollection) =>
    invoke<T[]>("read_private_audit_collection", { collection }),
  writePrivateAuditEntity: (collection: DesktopPrivateAuditCollection, entity: unknown) =>
    invoke<void>("write_private_audit_entity", { collection, entity }),
  createGovernanceSnapshot: <T>(plan: unknown) =>
    invoke<T>("create_governance_snapshot", { plan }),
  restoreGovernanceSnapshot: (snapshotId: string) =>
    invoke<number>("restore_governance_snapshot", { snapshotId }),
  deleteLibraryEntity: (collection: DesktopDeletableLibraryCollection, id: string) =>
    invoke<void>("delete_library_entity", { collection, id }),
  deleteMediaFile: (id: string) =>
    invoke<void>("delete_library_entity", { collection: "media-files", id }),
  listenProgress: (handler: (payload: DesktopTaskProgress) => void): Promise<UnlistenFn> =>
    listen<DesktopTaskProgress>(PROGRESS_EVENT, (event) => handler(event.payload)),
};
