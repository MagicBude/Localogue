import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "pnpm-workspace.yaml",
  "apps/desktop/package.json",
  "apps/desktop/src/App.tsx",
  "apps/desktop/vite.config.mts",
  "scripts/clean-desktop-generated-artifacts.mjs",
  "apps/desktop/src/tauri-bridge.ts",
  "apps/desktop/src/platform/tauri-library-repository.ts",
  "src/application/library/library-query.ts",
  "apps/desktop/src-tauri/Cargo.toml",
  "apps/desktop/src-tauri/tauri.conf.json",
  "apps/desktop/src-tauri/tauri.dev.conf.json",
  "apps/desktop/src-tauri/capabilities/default.json",
  "apps/desktop/src-tauri/permissions/desktop-runtime.toml",
  "apps/desktop/src-tauri/src/lib.rs",
  "apps/desktop/src-tauri/icons/32x32.png",
  "apps/desktop/src-tauri/icons/128x128.png",
  "apps/desktop/src-tauri/icons/128x128@2x.png",
  "apps/desktop/src-tauri/icons/icon.icns",
  "apps/desktop/src-tauri/icons/icon.ico",
];
const errors = [];
for (const file of required) if (!existsSync(path.join(root, file))) errors.push(`缺少 ${file}`);

if (!errors.length) {
  const release = JSON.parse(readFileSync(path.join(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"));
  const dev = JSON.parse(readFileSync(path.join(root, "apps/desktop/src-tauri/tauri.dev.conf.json"), "utf8"));
  if (!release.identifier || !dev.identifier || release.identifier === dev.identifier) {
    errors.push("Desktop Dev / Release identifier 必须不同，避免 AppData 污染。");
  }
  const csp = release.app?.security?.csp;
  if (typeof csp !== "string" || !csp.includes("connect-src ipc: http://ipc.localhost")) {
    errors.push("Desktop Tauri CSP 必须显式允许受控 IPC，不能使用 csp=null。");
  }
  const bundleIcons = release.bundle?.icon;
  if (!Array.isArray(bundleIcons) || !bundleIcons.includes("icons/icon.ico") || !bundleIcons.includes("icons/icon.icns")) {
    errors.push("Desktop Bundle 必须显式声明 Windows icon.ico 与 macOS icon.icns，避免 Tauri build resource 阶段缺少应用图标。");
  }
  const capability = readFileSync(path.join(root, "apps/desktop/src-tauri/capabilities/default.json"), "utf8");
  const permission = readFileSync(path.join(root, "apps/desktop/src-tauri/permissions/desktop-runtime.toml"), "utf8");
  if (!capability.includes('"desktop-runtime"')) errors.push("主窗口 Capability 必须显式引用 desktop-runtime 应用权限。");
  for (const command of ["pick_directory", "open_path", "reveal_in_folder", "probe_media", "walk_files", "sha256_file", "inspect_shared_pack", "read_library_collection", "write_library_entity", "delete_library_entity"]) {
    if (!permission.includes(`"${command}"`)) errors.push(`Desktop Runtime Permission 缺少命令：${command}`);
  }
  if (/shell:allow-(execute|spawn)/.test(capability + permission)) {
    errors.push("Desktop Capability 不允许向 Webview 暴露通用 shell execute/spawn。");
  }
  const rust = readFileSync(path.join(root, "apps/desktop/src-tauri/src/lib.rs"), "utf8");
  if (!rust.includes('name != "ffprobe"') || !rust.includes('name != "ffprobe.exe"')) {
    errors.push("ffprobe Command 必须保持可执行文件名白名单保护。");
  }
  if (!rust.includes("Url::parse") || !rust.includes('Some("localhost")') || !rust.includes('Some("127.0.0.1")')) {
    errors.push("Desktop open_web_url 必须使用 URL Parser 严格限制 localhost / 127.0.0.1。");
  }
  if (!rust.includes("require_safe_media_extension") || !rust.includes("SAFE_MEDIA_EXTENSIONS")) {
    errors.push("Desktop open_path 必须保持安全媒体扩展名白名单，不能退化成任意路径执行入口。");
  }
  const viteConfig = readFileSync(path.join(root, "apps/desktop/vite.config.mts"), "utf8");
  if (!viteConfig.includes("process.platform") || !viteConfig.includes("TAURI_ENV_PLATFORM")) {
    errors.push("Desktop Vite Target 必须同时支持 Tauri 平台变量与 Node 主机平台 fallback，避免 pnpm check 在 Windows 误走 WebKit Target。");
  }
  if (!viteConfig.includes('"chrome105"') || !viteConfig.includes('"safari14.1"')) {
    errors.push("Desktop Vite Target 必须保持 Windows chrome105 / WebKit safari14.1 基线。");
  }
  if (!viteConfig.includes('ignored: ["**/src-tauri/**"]')) {
    errors.push("Desktop Vite Dev Server 必须忽略 **/src-tauri/**，避免 Windows Cargo target 的 .pdb/.dll 与 Vite watcher 发生 EBUSY 冲突。");
  }
  if (/\?\s*["']chrome105["']\s*:\s*["']safari13["']/.test(viteConfig)) {
    errors.push("Desktop Vite Target 不允许恢复为未区分 Host Platform 的 chrome105 : safari13 二分逻辑。");
  }
  const desktopPackage = JSON.parse(readFileSync(path.join(root, "apps/desktop/package.json"), "utf8"));
  if (!desktopPackage.scripts?.dev?.includes("--config vite.config.mts") || !desktopPackage.scripts?.["build:webview"]?.includes("--config vite.config.mts")) {
    errors.push("Desktop Vite 命令必须显式使用 vite.config.mts，禁止重新依赖 Vite 自动配置发现。");
  }
  const desktopApp = readFileSync(path.join(root, "apps/desktop/src/App.tsx"), "utf8");
  const adapters = readFileSync(path.join(root, "apps/desktop/src/platform/tauri-platform-adapters.ts"), "utf8");
  if (!desktopApp.includes("MediaScanCoordinator") || !desktopApp.includes("TauriLibraryRepository")) {
    errors.push("V1-15 Desktop 必须复用共享 MediaScanCoordinator 与完整浏览型 TauriLibraryRepository。");
  }
  if (!adapters.includes("class TauriFileSystemAdapter") || !adapters.includes("class TauriFileHashAdapter")) {
    errors.push("V1-15 Desktop 必须继续实现 FileSystemPort / FileHashPort。");
  }
  if (!rust.includes("safe_collection_directory") || !rust.includes('"people"') || !rust.includes('"organizations"') || !rust.includes('"assets"')) {
    errors.push("V1-15 Desktop Repository 读取白名单必须覆盖 Canonical 浏览集合。");
  }
  if (!rust.includes("safe_writable_collection_directory") || !rust.includes('collection != "media-files"')) {
    errors.push("V1-15 Desktop Repository 写入权限必须继续只允许私人 media-files。");
  }
  if (!rust.includes("inspect_shared_pack") || !rust.includes('localogue-pack.json') || !rust.includes('kind=shared-library')) {
    errors.push("V1-15 Desktop 必须在 Rust 边界验证 Shared Pack manifest 与 library/ 目录。");
  }
  const desktopRepository = readFileSync(path.join(root, "apps/desktop/src/platform/tauri-library-repository.ts"), "utf8");
  const jsonRepository = readFileSync(path.join(root, "src/infrastructure/repositories/json-library-repository.ts"), "utf8");
  const queryCore = readFileSync(path.join(root, "src/application/library/library-query.ts"), "utf8");
  if (!desktopRepository.includes("queryWorks") || !desktopRepository.includes("queryPeople") || !jsonRepository.includes("queryWorks") || !jsonRepository.includes("queryPeople")) {
    errors.push("Web / Desktop Repository 必须共用 library-query 查询核心，禁止复制筛选排序规则。");
  }
  if (/node:|@tauri-apps\//.test(queryCore)) {
    errors.push("共享 library-query 核心必须保持平台中立，不能依赖 Node 或 Tauri。");
  }
  if (!rust.includes('format!("{:x}", digest.finalize())')) {
    errors.push("Rust 文件 SHA-256 必须先 finalize 摘要再执行十六进制格式化。");
  }
  const rootPackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  if (!rootPackage.scripts?.check?.startsWith("pnpm desktop:clean:legacy")) {
    errors.push("根 pnpm check 必须先清理 V1-13 历史 Vite 配置产物，保证 ZIP 覆盖升级具有确定性。");
  }

  const webSources = walkTextFiles(path.join(root, "src"));
  for (const file of webSources) {
    const content = readFileSync(file, "utf8");
    if (content.includes("@tauri-apps/")) errors.push(`Web 主应用不得直接 import Tauri API：${path.relative(root, file)}`);
  }
}

if (errors.length) {
  console.error("Localogue Desktop Boundary 校验失败：");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Localogue Desktop Boundary 校验通过：V1-15 共享查询核心、完整浏览 Repository、Shared Pack 验证、最小写权限与 Web/Tauri 分层均符合规则。");
}

function walkTextFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walkTextFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) output.push(full);
  }
  return output;
}
