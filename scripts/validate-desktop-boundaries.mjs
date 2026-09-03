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
  "apps/desktop/src/nfo-library-import.ts",
  "apps/desktop/src/local-asset-import.ts",
  "apps/desktop/src/desktop-asset-image.tsx",
  "apps/desktop/src/desktop-work-results.tsx",
  "apps/desktop/src/desktop-management.tsx",
  "src/application/library/library-query.ts",
  "src/application/importers/nfo-filename-metadata.ts",
  "src/infrastructure/importers/nfo-importer.ts",
  "apps/desktop/src-tauri/Cargo.toml",
  "apps/desktop/src-tauri/tauri.conf.json",
  "apps/desktop/src-tauri/tauri.dev.conf.json",
  "apps/desktop/src-tauri/capabilities/default.json",
  "apps/desktop/src-tauri/permissions/desktop-runtime.toml",
  "apps/desktop/src-tauri/gen/schemas/acl-manifests.json",
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
  const runtimeCommands = ["pick_directory", "open_path", "reveal_in_folder", "probe_media", "walk_files", "read_nfo_text", "import_private_asset_file", "read_private_asset_bytes", "sha256_file", "inspect_shared_pack", "read_library_collection", "write_library_entity", "write_private_audit_entity", "delete_library_entity"];
  for (const command of runtimeCommands) {
    if (!permission.includes(`"${command}"`)) errors.push(`Desktop Runtime Permission 缺少命令：${command}`);
  }
  const generatedAcl = readFileSync(path.join(root, "apps/desktop/src-tauri/gen/schemas/acl-manifests.json"), "utf8");
  for (const command of runtimeCommands) {
    if (!generatedAcl.includes(`"${command}"`)) errors.push(`Tauri 生成 ACL Manifest 尚未同步 V1-18 命令：${command}`);
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
    errors.push("V1-18 Desktop 必须继续复用共享 MediaScanCoordinator 与完整浏览型 TauriLibraryRepository。");
  }
  if (!desktopApp.includes("previewNfoImport") || !desktopApp.includes("importNfoPreview")) {
    errors.push("V1-18 Desktop Media 页面必须保留独立 NFO Preview -> Explicit Import 流程。");
  }
  const desktopManagement = readFileSync(path.join(root, "apps/desktop/src/desktop-management.tsx"), "utf8");
  for (const feature of ["CreateWorkPanel", "WorkEditor", "CreatePersonPanel", "PersonEditor", "MediaBindingPanel"]) {
    if (!desktopManagement.includes(feature)) errors.push(`V1-18 Desktop 交互对齐缺少：${feature}`);
  }
  if (!desktopManagement.includes("Private Override") || !desktopManagement.includes("saveMediaBindingReceipt")) {
    errors.push("V1-18 Shared 实体编辑必须写 Private Override，Media 手工绑定必须保留审计 Receipt。");
  }
  if (!desktopApp.includes("removePrivateAsset") || !desktopApp.includes("deletePrivateAsset")) {
    errors.push("V1-18 Work 详情必须提供显式 Private Asset 解除/删除入口，避免引用保护导致 Work 无法完成删除闭环。");
  }
  const desktopAssetImage = readFileSync(path.join(root, "apps/desktop/src/desktop-asset-image.tsx"), "utf8");
  const desktopWorkResults = readFileSync(path.join(root, "apps/desktop/src/desktop-work-results.tsx"), "utf8");
  if (!desktopWorkResults.includes('"grid" | "list" | "table"') || !desktopWorkResults.includes("DesktopWorkViewSwitcher")) {
    errors.push("V1-18 Desktop Works 必须对齐 Web 的海报墙 / 列表 / 表格三种表现视图。");
  }
  if (!desktopAssetImage.includes("readPrivateAssetBytes") || !rust.includes("read_private_asset_bytes")) {
    errors.push("V1-18 Desktop 必须通过受限 Private Asset Reader 显示本地图片，不能继续只画占位符。");
  }
  if (!rust.includes('target.starts_with(&asset_root)') || !rust.includes('canonical_target.starts_with(&canonical_root)') || !rust.includes('Component::ParentDir')) {
    errors.push("V1-18 Private Asset Reader 必须限制在当前 Private Library/asset-files 并拒绝路径穿越。");
  }
  if (!desktopApp.includes("syncUnifiedLibrary") || !desktopApp.includes("一键同步 Unified Library")) {
    errors.push("V1-18 Desktop Media 必须提供 NFO -> Asset -> Media 的统一同步入口，避免半同步状态。");
  }
  if (!adapters.includes("class TauriFileSystemAdapter") || !adapters.includes("class TauriFileHashAdapter")) {
    errors.push("V1-18 Desktop 必须继续实现 FileSystemPort / FileHashPort。");
  }
  if (!rust.includes("safe_collection_directory") || !rust.includes('"people"') || !rust.includes('"organizations"') || !rust.includes('"assets"')) {
    errors.push("V1-18 Desktop Repository 读取白名单必须覆盖 Canonical 浏览集合。");
  }
  for (const collection of ["works", "people", "organizations", "series", "genres", "tags", "media-files"]) {
    if (!rust.includes(`"${collection}"`)) errors.push(`V1-18 Private 写白名单缺少集合：${collection}`);
  }
  if (!rust.includes("safe_writable_collection_directory") || !rust.includes("validate_writable_entity")) {
    errors.push("V1-18 Desktop Canonical 写入必须同时经过集合白名单与最小结构校验。");
  }
  if (!/safe_writable_collection_directory[\s\S]{0,900}"assets"/.test(rust) || !rust.includes("import_private_asset_file")) {
    errors.push("V1-18 Desktop 必须允许受控写 Asset JSON，并通过专用 Native Command 把图片复制到 Private asset-files。");
  }
  if (!rust.includes("configured_private_library_path") || /fn write_library_entity\([^)]*library_path/.test(rust)) {
    errors.push("V1-18 写命令必须由 Rust 自己从 Desktop Settings 解析 Private Library，禁止 Webview 选择写根目录。");
  }
  if (!rust.includes('"works" | "people" | "assets" | "media-files"') || !rust.includes("ensure_private_delete_is_unreferenced")) {
    errors.push("V1-18 Private 删除必须只开放 Work / Person / Asset / MediaFile，并执行引用检查。");
  }
  if (!rust.includes("write_private_audit_entity") || !rust.includes('collection != "media-binding-receipts"')) {
    errors.push("V1-18 Media 手工绑定必须通过受限 Private Audit Writer 保存 media-binding-receipts。");
  }
  if (!rust.includes("read_nfo_text") || !rust.includes('extension != "nfo"') || !rust.includes("MAX_NFO_BYTES")) {
    errors.push("V1-18 NFO Reader 必须限制为 .nfo 普通文件，并保留单文件大小上限。");
  }
  if (!rust.includes("library_roots") || !desktopApp.includes("libraryRoots")) {
    errors.push("V1-18 Desktop Settings 必须提供 Unified Library Roots。");
  }
  if (!rust.includes("nfo_scan_paths") || !desktopApp.includes("nfoScanPaths")) {
    errors.push("V1-18 必须保留独立 NFO 根作为高级兼容路径。");
  }
  if (!rust.includes("inspect_shared_pack") || !rust.includes('localogue-pack.json') || !rust.includes('kind=shared-library')) {
    errors.push("V1-18 Desktop 必须继续在 Rust 边界验证 Shared Pack manifest 与 library/ 目录。");
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
  if (!rust.includes("async fn walk_files") || !rust.includes("spawn_blocking") || !rust.includes("VecDeque")) {
    errors.push("V1-18 Hotfix 的目录扫描必须在后台 worker 使用显式迭代队列，禁止重新退化为主线程递归式扫描。");
  }
  if (rust.includes("WalkDir::new") || rust.includes("use walkdir::WalkDir")) {
    errors.push("V1-18 Hotfix 不允许 walk_files 重新使用 WalkDir；需要保持可审计的迭代队列扫描实现。");
  }
  if (!rust.includes("is_filesystem_reparse_point") || !rust.includes("FILE_ATTRIBUTE_REPARSE_POINT") || !rust.includes("visited.insert") || !rust.includes("scan_visit_key")) {
    errors.push("V1-18 Hotfix 必须拒绝 Windows junction/reparse point，并以词法绝对路径 visited 去重目录，防止目录环。");
  }
  if (rust.includes("fs::canonicalize(&configured_root)")) {
    errors.push("V1-18 Hotfix 2 禁止把 fs::canonicalize(configured_root) 作为资料扫描前提；部分 Windows 可读卷会返回 OS 1005。");
  }
  if (!rust.includes("resolve_scan_root") || !rust.includes("fs::read_dir(&root)")) {
    errors.push("V1-18 Hotfix 2 必须以 metadata/read_dir 验证扫描根可读性，并允许不支持 canonicalize 的 Windows 卷正常扫描。");
  }
  if (rust.includes("[0_u8; 1024 * 1024]") || /\[0_u8;\s*[5-9][0-9]{5,}\]/.test(rust)) {
    errors.push("V1-18 Hotfix 3 禁止在 Native Command 调用链上分配超大固定栈缓冲；SHA-256 必须使用堆缓冲或小型流式缓冲。");
  }
  if (!rust.includes("vec![0_u8; 256 * 1024]") || !rust.includes("spawn_native_io")) {
    errors.push("V1-18 Hotfix 3 必须使用堆分配 SHA-256 缓冲，并把高频阻塞 Native I/O 移出 Tauri main thread。");
  }
  for (const command of ["stat_path", "path_exists", "read_nfo_text", "import_private_asset_file", "read_private_asset_bytes", "sha256_file", "read_library_collection", "write_library_entity", "write_private_audit_entity", "delete_library_entity"]) {
    if (!rust.includes(`async fn ${command}`)) errors.push(`V1-18 Hotfix 3 高频 Native I/O 命令必须为 async：${command}`);
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
  console.log("Localogue Desktop Boundary 校验通过：V1-18 Unified Library Sync、Private Asset 安全读取、Works 三视图、Desktop CRUD、Media 手工绑定审计、Shared Pack 管理，以及 Hotfix 迭代目录扫描 / junction 防环边界均符合规则。");
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
