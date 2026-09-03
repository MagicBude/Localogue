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
  "apps/desktop/src/contracts.ts",
  "apps/desktop/src/platform/tauri-library-repository.ts",
  "apps/desktop/src/nfo-library-import.ts",
  "apps/desktop/src/local-asset-import.ts",
  "apps/desktop/src/desktop-asset-image.tsx",
  "apps/desktop/src/desktop-work-results.tsx",
  "apps/desktop/src/desktop-work-explorer.tsx",
  "apps/desktop/src/desktop-person-explorer.tsx",
  "apps/desktop/src/desktop-catalog-browser.tsx",
  "apps/desktop/src/desktop-management.tsx",
  "apps/desktop/src/desktop-i18n.tsx",
  "apps/desktop/src/desktop-governance.tsx",
  "apps/desktop/src/desktop-governance-service.ts",
  "apps/desktop/src/desktop-vocabulary-repository.ts",
  "src/application/crypto/sha256.ts",
  "docs/decisions/ADR-039-desktop-governance-private-audit-and-snapshot-boundary.md",
  "docs/development/v1-23-desktop-governance-parity-walkthrough.md",
  "V1_23_MANIFEST.md",
  "apps/desktop/src/styles.css",
  "src/application/library/library-query.ts",
  "src/application/importers/nfo-filename-metadata.ts",
  "src/application/importers/import-classification-normalizer.ts",
  "apps/desktop/src/vocabulary-repair.ts",
  "resources/vocabularies/import-term-mappings.json",
  "resources/vocabularies/import-term-mappings.csv",
  "docs/vocabulary/import-term-mappings.md",
  "resources/vocabularies/genre-source-aliases.json",
  "resources/vocabularies/genre-source-aliases.csv",
  "docs/vocabulary/genre-source-aliases.md",
  "src/application/services/genre-localization-service.ts",
  "apps/desktop/src/use-stable-async-data.ts",
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
  const runtimeCommands = ["pick_directory", "open_path", "reveal_in_folder", "probe_media", "walk_files", "read_nfo_text", "import_private_asset_file", "read_private_asset_bytes", "sha256_file", "inspect_shared_pack", "read_library_collection", "write_library_entity", "read_private_audit_collection", "write_private_audit_entity", "restore_private_snapshot", "delete_library_entity"];
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
  const desktopContracts = readFileSync(path.join(root, "apps/desktop/src/contracts.ts"), "utf8");
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
  for (const collection of ["works", "people", "genres", "tags", "assets", "media-files"]) {
    if (!desktopContracts.includes(`| "${collection}"`)) errors.push(`V1-22 DesktopDeletableLibraryCollection 缺少 Native 已受控开放的集合：${collection}`);
  }
  if (!desktopApp.includes("function WorkAssetGallery") || !desktopApp.includes("desktop-work-gallery__arrow") || !desktopApp.includes("desktop-work-record--stacked")) {
    errors.push("V1-22 Hotfix Work Detail 必须保持顶部媒体画廊 + 下方全宽 Metadata Table，避免恢复左图右表的高度空洞布局。");
  }
  if (!desktopApp.includes('setOrientation(ratio < 0.88 ? "portrait" : ratio > 1.12 ? "landscape" : "square")')) {
    errors.push("V1-22 Hotfix 2 Work Media Gallery 必须根据真实图片宽高比切换 portrait / landscape / square 展示策略，不能恢复固定横向画布。");
  }
  if (!desktopApp.includes('asset.type !== "poster"') || !desktopApp.includes("Poster is intentionally excluded from the detail Hero Gallery")) {
    errors.push("V1-22 Hotfix 3 Work Detail Hero Gallery 必须排除 poster；Poster 只用于作品墙/列表封面和资产管理，不能再强塞进宽屏 Hero。 ");
  }
  const desktopAssetImage = readFileSync(path.join(root, "apps/desktop/src/desktop-asset-image.tsx"), "utf8");
  const desktopWorkResults = readFileSync(path.join(root, "apps/desktop/src/desktop-work-results.tsx"), "utf8");
  if (!desktopWorkResults.includes('"grid" | "list" | "table"') || !desktopWorkResults.includes("DesktopWorkViewSwitcher")) {
    errors.push("V1-18 Desktop Works 必须对齐 Web 的海报墙 / 列表 / 表格三种表现视图。");
  }
  const desktopWorkExplorer = readFileSync(path.join(root, "apps/desktop/src/desktop-work-explorer.tsx"), "utf8");
  const desktopPersonExplorer = readFileSync(path.join(root, "apps/desktop/src/desktop-person-explorer.tsx"), "utf8");
  const desktopCatalogBrowser = readFileSync(path.join(root, "apps/desktop/src/desktop-catalog-browser.tsx"), "utf8");
  const desktopI18n = readFileSync(path.join(root, "apps/desktop/src/desktop-i18n.tsx"), "utf8");
  const desktopStyles = readFileSync(path.join(root, "apps/desktop/src/styles.css"), "utf8");
  if (!desktopStyles.includes(".desktop-work-gallery__stage.is-portrait") || !desktopStyles.includes(".desktop-work-gallery__stage.is-landscape") || !desktopStyles.includes(".desktop-work-gallery__stage.is-square")) {
    errors.push("V1-22 Hotfix 2 Gallery 样式必须保留 portrait / landscape / square 三种真实宽高比策略。");
  }
  if (!desktopStyles.includes(".content-shell") || !desktopStyles.includes("max-width: none")) {
    errors.push("V1-22 Hotfix 2 Desktop 主内容区必须保持流式宽度，不能恢复固定 1460px max-width 导致大屏右侧空白。");
  }
  for (const token of ["personIds", "directorIds", "makerIds", "labelIds", "seriesIds", "genreIds", "workTypeIds", "tagIds", "releaseYears", "releaseFrom", "releaseTo", "durationMin", "durationMax", "hasCover", "hasMedia"]) {
    if (!desktopWorkExplorer.includes(token)) errors.push(`V1-19 Desktop Work 多维筛选缺少 WorkQuery 条件：${token}`);
  }
  if (!desktopWorkExplorer.includes("DesktopWorkFilterChips") || !desktopWorkExplorer.includes("DesktopWorkViewSwitcher")) {
    errors.push("V1-19 Desktop Work Explorer 必须同时保留已选筛选 Chips 与三视图切换。");
  }
  for (const token of ["statuses", "birthYears", "debutYears", "retirementYears", "heightMin", "heightMax", "PersonSort"]) {
    if (!desktopPersonExplorer.includes(token)) errors.push(`V1-19 Desktop 人物高级筛选缺少条件：${token}`);
  }
  if (!desktopApp.includes("fixedPersonId={id}") || !desktopApp.includes("recentCards") || !desktopApp.includes('view="grid"')) {
    errors.push("V1-19 首页最近作品与 Person 相关作品必须复用真实海报 Work Explorer / Work Results，而不是旧占位 Tile。");
  }
  for (const token of ["makers", "labels", "series", "genres", "directors", "workTypes", "tags"]) {
    if (!desktopCatalogBrowser.includes(token)) errors.push(`V1-19 Desktop 分类浏览缺少目录维度：${token}`);
  }
  if (!desktopApp.includes('{ id: "browse", label: "浏览"')) {
    errors.push("V1-19 Desktop 主导航必须提供分类浏览入口。");
  }
  if (!desktopI18n.includes("DesktopI18nProvider") || !desktopI18n.includes("DesktopLanguageControls") || !desktopI18n.includes("useDesktopI18n")) {
    errors.push("V1-20 Desktop 必须通过统一 I18N Context 提供三语界面与语言控制，禁止各页面维护独立语言状态。");
  }
  for (const token of ["localogue_ui_language", "localogue_metadata_language", '"zh-CN"', '"ja"', '"en"']) {
    if (!desktopI18n.includes(token)) errors.push(`V1-20 Desktop I18N 缺少语言偏好契约：${token}`);
  }
  const desktopTranslationKeys = {
    ja: collectDesktopTranslationKeys(desktopI18n, "ja"),
    en: collectDesktopTranslationKeys(desktopI18n, "en"),
  };
  const desktopLiteralTKeys = collectDesktopLiteralTKeys(path.join(root, "apps/desktop/src"));
  for (const language of ["ja", "en"]) {
    for (const key of desktopLiteralTKeys) {
      if (!desktopTranslationKeys[language].has(key)) {
        errors.push(`V1-20 Desktop I18N ${language} 缺少 t() 文案：${JSON.stringify(key)}`);
      }
    }
  }
  for (const key of desktopTranslationKeys.ja) {
    if (!desktopTranslationKeys.en.has(key)) errors.push(`V1-20 Desktop I18N 英文表缺少日文表已有 key：${JSON.stringify(key)}`);
  }
  for (const key of desktopTranslationKeys.en) {
    if (!desktopTranslationKeys.ja.has(key)) errors.push(`V1-20 Desktop I18N 日文表缺少英文表已有 key：${JSON.stringify(key)}`);
  }
  if (!desktopApp.includes("localogue.desktop.sidebar-collapsed") || !desktopApp.includes("is-sidebar-collapsed")) {
    errors.push("V1-20 Desktop Sidebar 必须支持显式折叠并本机持久化，不允许只能依赖屏宽隐式收起。");
  }
  if (!desktopStyles.includes("grid-template-columns: 188px") || !desktopStyles.includes("grid-template-columns: 72px")) {
    errors.push("V1-20 Desktop Sidebar 必须保持默认窄栏与折叠窄条两种明确宽度。");
  }
  if (!desktopStyles.includes("minmax(330px, 380px)") || !desktopStyles.includes("white-space: normal")) {
    errors.push("V1-20 Work Facet Rail 必须加宽并允许长筛选项换行，避免标签被窄栏截断。");
  }
  for (const token of ['poster: 0', 'fanart: 1', 'screenshot: 2', 'cover: 3']) {
    if (!desktopApp.includes(token)) errors.push(`V1-20 Work Asset 展示顺序缺少：${token}`);
  }
  if (desktopApp.includes("本地海报 / 封面 / Fanart")) {
    errors.push("V1-20 不允许继续使用中英混排且语义不明确的本地海报 / 封面 / Fanart 标题。");
  }
  for (const token of ['poster:', 'fanart:', 'screenshot:', '海报', '背景图', '缩略图', 'ポスター', '背景画像', 'サムネイル', 'Poster', 'Background', 'Thumbnail']) {
    if (!desktopI18n.includes(token)) errors.push(`V1-20 Asset I18N 语义映射缺少：${token}`);
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
  if (!rust.includes('"works" | "people" | "genres" | "tags" | "assets" | "media-files"') || !rust.includes("ensure_private_delete_is_unreferenced")) {
    errors.push("V1-21 Private 删除必须只开放受引用保护的 Work / Person / Genre / Tag / Asset / MediaFile，并执行引用检查。");
  }
  if (!rust.includes("write_private_audit_entity") || !rust.includes("is_private_audit_collection") || !rust.includes('"media-binding-receipts"')) {
    errors.push("V1-23 Private Audit Writer 必须保留受限集合白名单，并继续支持 media-binding-receipts。");
  }
  const governanceAuditCollections = ["evidence", "evidence-lifecycle", "review-commits", "snapshots", "restore-receipts", "provenance", "media-binding-receipts"];
  for (const collection of governanceAuditCollections) {
    if (!desktopContracts.includes(`| "${collection}"`) && !desktopContracts.includes(`= "${collection}"`)) errors.push(`V1-23 DesktopPrivateAuditCollection 缺少：${collection}`);
    if (!rust.includes(`"${collection}"`)) errors.push(`V1-23 Rust Private Audit 白名单缺少：${collection}`);
  }
  const desktopGovernance = readFileSync(path.join(root, "apps/desktop/src/desktop-governance.tsx"), "utf8");
  const desktopGovernanceService = readFileSync(path.join(root, "apps/desktop/src/desktop-governance-service.ts"), "utf8");
  const commitPlanService = readFileSync(path.join(root, "src/application/review/commit-plan-service.ts"), "utf8");
  const sha256Core = readFileSync(path.join(root, "src/application/crypto/sha256.ts"), "utf8");
  if (!desktopApp.includes('id: "governance"') || !desktopApp.includes("<DesktopGovernance")) errors.push("V1-23 Desktop 必须提供 Governance 一级入口。 ");
  for (const token of ["Evidence", "Curation", "History", "restoreDesktopCommit", "executeDesktopCanonicalCommit"]) {
    if (!desktopGovernance.includes(token) && !desktopGovernanceService.includes(token)) errors.push(`V1-23 Desktop Governance 缺少能力：${token}`);
  }
  if (!rust.includes("restore_private_snapshot") || !rust.includes("validate_snapshot_restore_entry") || !rust.includes("include_audit_state")) errors.push("V1-23 Snapshot Restore 必须由 Rust 在受限路径白名单内执行。 ");
  if (commitPlanService.includes("node:crypto") || !commitPlanService.includes("sha256Text") || !sha256Core.includes("crypto.subtle.digest")) errors.push("V1-23 Commit Plan 指纹必须使用平台中立 WebCrypto SHA-256，不能依赖 Node crypto。 ");
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

  const classificationNormalizer = readFileSync(path.join(root, "src/application/importers/import-classification-normalizer.ts"), "utf8");
  const vocabularyRepair = readFileSync(path.join(root, "apps/desktop/src/vocabulary-repair.ts"), "utf8");
  const mappingDocument = JSON.parse(readFileSync(path.join(root, "resources/vocabularies/import-term-mappings.json"), "utf8"));
  const mappingCsv = readFileSync(path.join(root, "resources/vocabularies/import-term-mappings.csv"), "utf8").replace(/\r/g, "").trim();
  const mappingDocs = readFileSync(path.join(root, "docs/vocabulary/import-term-mappings.md"), "utf8");
  const controlledGenres = JSON.parse(readFileSync(path.join(root, "resources/vocabularies/genres.json"), "utf8"));
  const controlledWorkTypes = JSON.parse(readFileSync(path.join(root, "resources/vocabularies/work-types.json"), "utf8"));
  for (const token of ["normalizeImportedClassifications", "系列", "片商", "发行", "单体作品", "イメージビデオ", "unmappedTerms"]) {
    if (!classificationNormalizer.includes(token)) errors.push(`V1-21 导入分类规范器缺少规则：${token}`);
  }
  if (!Array.isArray(mappingDocument.rules) || mappingDocument.rules.length < 10 || !mappingDocument.unmappedPolicy) {
    errors.push("V1-21 resources/vocabularies/import-term-mappings.json 必须包含可审计映射规则与 unmappedPolicy。");
  } else {
    const csvLines = mappingCsv.split("\n").filter(Boolean);
    if (csvLines.length !== mappingDocument.rules.length + 1) {
      errors.push(`V1-21 Vocabulary CSV 必须与 JSON 映射逐条同步：JSON ${mappingDocument.rules.length} 条，CSV ${Math.max(0, csvLines.length - 1)} 条。`);
    }
    const genreIds = new Set((controlledGenres.items ?? []).map((item) => item.id));
    const workTypeIds = new Set((controlledWorkTypes.items ?? []).map((item) => item.id));
    for (const rule of mappingDocument.rules) {
      if (!mappingCsv.includes(rule.source) || !mappingCsv.includes(rule.target)) {
        errors.push(`V1-21 Vocabulary CSV 缺少 JSON 映射：${rule.source} -> ${rule.target}`);
      }
      if (typeof rule.target === "string" && rule.target.startsWith("genre:") && !genreIds.has(rule.target.slice("genre:".length))) {
        errors.push(`V1-21 Vocabulary 映射指向不存在的 Genre ID：${rule.target}`);
      }
      if (typeof rule.target === "string" && rule.target.startsWith("workType:") && !workTypeIds.has(rule.target.slice("workType:".length))) {
        errors.push(`V1-21 Vocabulary 映射指向不存在的 Work Type ID：${rule.target}`);
      }
    }
  }
  for (const token of ["Source `<tag>` ≠ Localogue Tag", "Work Type", "Unknown / Unmapped", "系列: ALL NUDE"]) {
    if (!mappingDocs.includes(token)) errors.push(`V1-21 Vocabulary 映射文档缺少关键说明：${token}`);
  }
  if (!vocabularyRepair.includes('genre_nfo_') || !vocabularyRepair.includes('tag_nfo_') || !vocabularyRepair.includes("previewVocabularyRepair") || !vocabularyRepair.includes("applyVocabularyRepair")) {
    errors.push("V1-21 Desktop 必须提供针对早期 NFO Genre/Tag 污染的显式 Preview -> Repair 工具，并只收口 NFO 自动生成实体。");
  }
  if (!vocabularyRepair.includes('isPrivateEntity("works", work.id)')) {
    errors.push("V1-21 历史 Vocabulary Repair 必须显式限制为 Private Work，不能因为 Shared ID 恰好匹配旧 NFO 前缀而创建 Override。");
  }
  if (!desktopApp.includes("分类词表审计") || !desktopApp.includes("workTypeDefinition") || !desktopApp.includes("DenseDetailRow") || !desktopApp.includes('label={t("作品类型")}') || !desktopApp.includes('label={t("题材")}') || !desktopApp.includes('label={t("标签")}')) {
    errors.push("V1-21/V1-22 Desktop 必须在 Work Detail 主信息区分开展示 Work Type / Genre / Tag，并提供分类词表审计入口。");
  }

  const genreVocabulary = JSON.parse(readFileSync(path.join(root, "resources/vocabularies/genres.json"), "utf8"));
  const genreVocabularyCsv = readFileSync(path.join(root, "resources/vocabularies/genres.csv"), "utf8").replace(/\r/g, "").trim();
  const genreSourceAliases = JSON.parse(readFileSync(path.join(root, "resources/vocabularies/genre-source-aliases.json"), "utf8"));
  const genreSourceAliasCsv = readFileSync(path.join(root, "resources/vocabularies/genre-source-aliases.csv"), "utf8").replace(/\r/g, "").trim();
  const genreLocalization = readFileSync(path.join(root, "src/application/services/genre-localization-service.ts"), "utf8");
  const stableAsync = readFileSync(path.join(root, "apps/desktop/src/use-stable-async-data.ts"), "utf8");
  const genreAliasDocs = readFileSync(path.join(root, "docs/vocabulary/genre-source-aliases.md"), "utf8");
  if (!Array.isArray(genreVocabulary.items) || genreVocabulary.items.length !== 33) {
    errors.push(`V1-22 Hotfix 3 Canonical Genre Vocabulary 应为 33 条受控分类，当前 ${genreVocabulary.items?.length ?? 0} 条。`);
  } else {
    const ids = new Set();
    for (const item of genreVocabulary.items) {
      if (!item.id || ids.has(item.id)) errors.push(`Canonical Genre ID 缺失或重复：${item.id}`);
      ids.add(item.id);
      for (const field of ["ja", "zh-CN", "en"]) if (!String(item[field] ?? "").trim()) errors.push(`Canonical Genre ${item.id} 缺少 ${field}`);
    }
    for (const deprecated of ["first_work", "anniversary", "high_definition"]) {
      if (ids.has(deprecated)) errors.push(`V1-22 Hotfix 3 不允许将 ${deprecated} 继续作为 Canonical Genre。`);
    }
  }
  if (genreVocabularyCsv.split("\n").filter(Boolean).length !== 34) {
    errors.push("Canonical Genre CSV 必须包含表头 + 33 条受控数据。");
  }
  if (!Array.isArray(genreSourceAliases.items) || genreSourceAliases.items.length !== 67) {
    errors.push(`V1-22 Hotfix 3 Approved Genre Source Aliases 应为 67 条精选来源别名，当前 ${genreSourceAliases.items?.length ?? 0} 条。`);
  } else {
    const genreIds = new Set(genreVocabulary.items.map((item) => item.id));
    const keys = new Set();
    for (const item of genreSourceAliases.items) {
      if (!genreIds.has(item.canonicalId)) errors.push(`Genre Source Alias 指向不存在的 Canonical ID：${item.canonicalId}`);
      const key = `${item.canonicalId}::${item.sourceId}`;
      if (!item.sourceId || keys.has(key)) errors.push(`Genre Source Alias 缺失或重复：${key}`);
      keys.add(key);
      for (const field of ["ja", "zh-CN", "en"]) if (!String(item[field] ?? "").trim()) errors.push(`Genre Source Alias ${key} 缺少 ${field}`);
    }
  }
  if (genreSourceAliasCsv.split("\n").filter(Boolean).length !== 68) {
    errors.push("Approved Genre Source Alias CSV 必须包含表头 + 67 条精选映射。 ");
  }
  for (const token of ["localizeGenre", "genre-source-aliases", "Canonical vocabulary", "getLanguageFallback"]) {
    if (!genreLocalization.includes(token)) errors.push(`V1-22 Hotfix 3 Genre 本地化服务缺少精选词表语义：${token}`);
  }
  for (const token of ["67", "不是完整来源分类表", "Canonical Genre", "genre.csv"]) {
    if (!genreAliasDocs.includes(token)) errors.push(`V1-22 Hotfix 3 Genre Source Alias 文档缺少边界说明：${token}`);
  }
  for (const obsolete of ["resources/vocabularies/source-genre-catalog.json", "resources/vocabularies/source-genre-catalog.csv", "docs/vocabulary/source-genre-catalog.md"]) {
    if (existsSync(path.join(root, obsolete))) errors.push(`V1-22 Hotfix 3 已废弃完整 Source Genre Catalog，不应继续保留：${obsolete}`);
  }
  if (!stableAsync.includes("stale-while-refresh") || !stableAsync.includes("refreshing") || !stableAsync.includes("current.value !== undefined")) {
    errors.push("V1-22 Desktop 异步数据必须保持 stale-while-refresh，禁止筛选/切语言时用矮 LoadingState 替换整页导致 scrollTop 回跳。 ");
  }
  if (!desktopWorkExplorer.includes("useStableAsyncData") || !desktopPersonExplorer.includes("useStableAsyncData") || !desktopCatalogBrowser.includes("useStableAsyncData")) {
    errors.push("V1-22 Works / People / Catalog 必须统一使用 Stable Async Refresh。 ");
  }
  for (const token of ["desktop-work-record", "desktop-metadata-table", "DenseDetailRow", "DenseChips", 't("题材")', 't("标签")']) {
    if (!desktopApp.includes(token) && !desktopStyles.includes(token)) errors.push(`V1-22 Work Detail 高密度信息架构缺少：${token}`);
  }
  if (!desktopI18n.includes("语言（界面 + 元数据）") || !desktopI18n.includes("setMetadataLanguage(language)")) {
    errors.push("V1-22 顶部主语言切换必须默认联动 UI + Metadata，保留 Metadata Advanced 独立覆盖。 ");
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
  console.log("Localogue Desktop Boundary 校验通过：V1-23 Governance / Private Audit / Snapshot Restore，以及 V1-22 Presentation / Vocabulary、V1-18 Native I/O / Unified Sync 安全边界均符合规则。");
}

function collectDesktopTranslationKeys(source, language) {
  const output = new Set();
  for (const declaration of ["const translations", "const supplementalTranslations"]) {
    const declarationIndex = source.indexOf(declaration);
    if (declarationIndex < 0) continue;
    const languageMatch = new RegExp(`\\b${language}\\s*:\\s*\\{`).exec(source.slice(declarationIndex));
    if (!languageMatch) continue;
    const braceIndex = declarationIndex + languageMatch.index + languageMatch[0].lastIndexOf("{");
    const block = readBalancedObject(source, braceIndex);
    for (const match of block.matchAll(/^\s*"((?:\\.|[^"\\])*)"\s*:/gm)) {
      output.add(unescapeTranslationKey(match[1]));
    }
  }
  return output;
}

function collectDesktopLiteralTKeys(directory) {
  const output = new Set();
  for (const file of walkTextFiles(directory)) {
    if (file.endsWith(`${path.sep}desktop-i18n.tsx`)) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\bt\(\s*(["'])(.*?)\1/gs)) {
      output.add(unescapeTranslationKey(match[2]));
    }
  }
  return output;
}

function readBalancedObject(source, braceIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = braceIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(braceIndex + 1, index);
    }
  }
  return "";
}

function unescapeTranslationKey(value) {
  return value
    .replaceAll("\\\\n", "\\n")
    .replaceAll('\\\\"', '"')
    .replaceAll("\\\\'", "'")
    .replaceAll("\\\\\\\\", "\\\\");
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
