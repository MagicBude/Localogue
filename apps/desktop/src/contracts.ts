/**
 * Desktop Webview 不自行复制 Runtime Contract。
 * 这里用 type-only re-export 直接复用主项目 Application 层的纯数据协议。
 */
export type {
  DesktopBootstrapSettings,
  DesktopMediaProbeRequest,
  DesktopMediaProbeResult,
  DesktopRuntimeInfo,
  DesktopTaskProgress,
  DesktopTaskStage,
} from "../../../src/application/platform/desktop-runtime-contract";
