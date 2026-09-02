import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  DesktopBootstrapSettings,
  DesktopMediaProbeResult,
  DesktopRuntimeInfo,
  DesktopTaskProgress,
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
  listenProgress: (handler: (payload: DesktopTaskProgress) => void): Promise<UnlistenFn> =>
    listen<DesktopTaskProgress>(PROGRESS_EVENT, (event) => handler(event.payload)),
};
