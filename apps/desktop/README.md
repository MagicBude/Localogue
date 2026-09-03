# Localogue Desktop

V1-21：**Vocabulary Governance & Work Metadata Visibility**。

Desktop 已从 Runtime 验证壳升级为正式 Localogue 应用入口。V1-19 对齐 Discovery / Presentation，V1-20 对齐 UX 与中 / 日 / 英 i18n；V1-21 根据真实 NFO 数据修复来源分类污染：Series / Work Type / Genre / Tag 经过统一 Vocabulary Router，再进入 Canonical，并提供历史 NFO 分类审计与显式修复。它与 Next.js Web 共享 Domain / Application Query Core，但使用 Tauri/Rust 作为本地平台适配层。

当前提供：

- Home / Works / People / Media / Packs / Settings 一级页面；
- Work / Person 详情与基础关系导航；
- Works 海报墙 / 列表 / 表格三种展示方式；
- Private poster / cover 受限 Native IPC 实际显示；
- Unified Library NFO → Asset → Media 一键同步；
- `TauriLibraryRepository` 合并 Private Library 与 Shared Packs；
- Works / People 查询复用 Web 的 `library-query` 纯 Application Core；
- Work / Person Private CRUD；Shared Entity 保存为同 ID Private Override；
- Work 元数据关系编辑、Media ↔ Work bind / rebind / unbind 与审计 Receipt；
- Shared Pack Native 校验、挂载、优先级调整与卸载；
- `libraryRoots` Unified Source，保留 `mediaScanPaths / nfoScanPaths` 高级兼容路径；
- NFO Work Group Preview 与显式 Bootstrap Import；
- 本地 poster / cover / fanart / thumb Preview 与 Private Asset Import；
- XML 番号优先、文件名番号 / 日期 / 片名 fallback；
- Shared Pack Native Manifest 校验；
- 原生目录 / 媒体文件选择；
- 增量媒体扫描、SHA-256 与 Rust `ffprobe`；
- 默认程序打开与资源管理器 / Finder 定位；
- Tauri App Config / App Local Data；
- Dev / Release identifier 隔离。
- Sidebar 默认收窄并支持本机持久化折叠；
- Work Facet Rail 加宽，长选项允许换行；
- poster / fanart / screenshot / cover 使用一致的三语语义和固定展示顺序；
- UI Language 与 Metadata Language 独立支持 `zh-CN / ja / en`；
- NFO 混合 `<genre>/<tag>` 经过统一 Vocabulary Router，不再直接复制到 Canonical；
- Media 页面提供历史 NFO 分类词表审计 / 预览 / 显式修复；
- Work Detail 分开展示 Work Type / Genre / Tag，Work Editor 可显式维护 Work Type。

## V1-18 权限边界

Desktop 可以读取 `works / people / organizations / series / genres / tags / assets`，`media-files` 永远属于 Private Layer。

为了用户明确确认的 NFO / Local Asset Bootstrap Ingest，Native Writer 允许写 Private：

```text
works / people / organizations / series / genres / tags / assets / media-files
```

但边界不是“Webview 传一个目录就写”：Rust 会自己读取当前 Desktop Settings 中配置的 `libraryPath`，所以写目标只能是 Private Library，Shared Pack 不能借用 Writer 写入。

另外：

- `assets` 只能通过受控 Native 图片导入 + Private Writer 元数据写入；图片扩展名、大小与文件签名会在 Rust 校验；
- Private 删除只开放受控 `works / people / genres / tags / assets / media-files`，并由 Rust 在删除前执行引用保护；Genre / Tag 删除前会检查 Work 引用；
- Work 详情可先解除 / 删除 Private Asset 元数据，再完成受保护的 Work 删除；原始图片不会被自动物理删除；
- NFO 导入已有 Work 只能 fill / merge，不静默覆盖已有核心事实。

完整 Evidence / Review / Curation / History、字段级冲突治理与 Portable Pack 完整交互继续属于 V1-22。Media ↔ Work 的 bind / rebind / unbind 与 `media-binding-receipts` 已在 V1-17 接入；不要在 Desktop 侧复制一套 Next.js/Node 实现。

## 开发

在仓库根目录：

```bash
pnpm install
pnpm desktop:doctor
pnpm desktop:rust:check
pnpm desktop:dev
```

只检查 Desktop Webview：

```bash
pnpm desktop:check
```

构建 Tauri executable：

```bash
pnpm desktop:build
```

当前仍优先验证应用功能与边界；安装器、签名、自动更新和完整 ffprobe Sidecar 发布链路后续单独处理。

完整说明见：

- `docs/desktop/tauri-prerequisites.md`
- `docs/architecture/desktop-runtime.md`
- `docs/development/v1-17-unified-library-source-and-local-assets-walkthrough.md`
- `docs/development/v1-18-desktop-presentation-parity-and-unified-sync-walkthrough.md`
- `docs/development/v1-21-vocabulary-governance-walkthrough.md`
- `docs/vocabulary/import-term-mappings.md`
