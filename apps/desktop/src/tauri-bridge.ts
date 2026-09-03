import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  DesktopBootstrapSettings,
  DesktopMediaProbeResult,
  DesktopRuntimeInfo,
  DesktopTaskProgress,
  DesktopFileEntry,
  DesktopFileStat,
  DesktopLibraryCollection,
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
  sha256File: (path: string) => invoke<string>("sha256_file", { path }),
  inspectSharedPack: (packPath: string) =>
    invoke<DesktopSharedPackInfo>("inspect_shared_pack", { packPath }),
  readLibraryCollection: <T>(libraryPath: string, collection: DesktopLibraryCollection) =>
    invoke<T[]>("read_library_collection", { libraryPath, collection }),
  writeLibraryEntity: (libraryPath: string, collection: "media-files", entity: unknown) =>
    invoke<void>("write_library_entity", { libraryPath, collection, entity }),
  deleteLibraryEntity: (libraryPath: string, collection: "media-files", id: string) =>
    invoke<void>("delete_library_entity", { libraryPath, collection, id }),
  listenProgress: (handler: (payload: DesktopTaskProgress) => void): Promise<UnlistenFn> =>
    listen<DesktopTaskProgress>(PROGRESS_EVENT, (event) => handler(event.payload)),
};
