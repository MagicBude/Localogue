import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

type DesktopPlatform = "windows" | "macos" | "linux";

/**
 * Tauri CLI 会在 tauri dev / tauri build 时注入 TAURI_ENV_PLATFORM。
 * 但 pnpm check 会直接执行 vite build，此时该变量不存在。
 *
 * 如果这里简单写成 `windows ? chrome105 : safari...`，Windows 上的普通
 * Webview 构建就会被错误地当成 Safari 目标。V1-13 因此明确增加 Node
 * 主机平台 fallback，使独立 Vite Check 与真正 Tauri Build 使用一致的平台语义。
 */
function resolveDesktopPlatform(): DesktopPlatform {
  const tauriPlatform = process.env.TAURI_ENV_PLATFORM;

  if (tauriPlatform === "windows" || tauriPlatform === "macos" || tauriPlatform === "linux") {
    return tauriPlatform;
  }

  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  return "linux";
}

const desktopPlatform = resolveDesktopPlatform();

/**
 * Windows WebView2 保持 Tauri 推荐的 Chromium 105 基线。
 *
 * WebKit 侧不再沿用 Tauri 文档中基于 Vite 5.4.8 示例的 safari13。Vite 8 +
 * esbuild 0.28 对较旧 Safari target 的 destructuring compatibility transform
 * 会触发“不支持降级”的错误；Safari 14.1 起 Vite 可以安全保留 destructuring。
 * Localogue Desktop Alpha 因此将 WebKit JavaScript 基线明确提升到 safari14.1。
 */
const webviewTarget = desktopPlatform === "windows" ? "chrome105" : "safari14.1";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "../../src") } },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
    watch: {
      // Rust 源码与 Cargo target 由 Tauri/Cargo 自己监听。
      // Windows 下 MSVC 会短暂锁定 .pdb/.dll；如果 Vite 同时监听
      // src-tauri/target，会触发 EBUSY 并导致 beforeDevCommand 退出。
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    target: webviewTarget,
    minify: process.env.TAURI_ENV_DEBUG ? false : "oxc",
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
});
