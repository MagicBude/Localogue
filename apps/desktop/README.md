# Localogue Desktop

V1-16：**Desktop Feature Parity II — Independent NFO Library Ingest**。

Desktop 已从 V1-13/V1-14 的 Runtime 验证壳升级为正式 Localogue 应用入口，并在 V1-16 增加独立 NFO 资料库迁移能力。它与 Next.js Web 共享 Domain / Application 规则，但使用 Tauri/Rust 作为本地平台适配层。

当前提供：

- Home / Works / People / Media / Packs / Settings 一级页面；
- Work / Person 详情与基础关系导航；
- `TauriLibraryRepository` 合并 Private Library 与 Shared Packs；
- Works / People 查询复用 Web 的 `library-query` 纯 Application Core；
- 独立 `nfoScanPaths`、NFO Preview 与显式 Bootstrap Import；
- XML 番号优先、文件名番号 / 日期 / 片名 fallback；
- Shared Pack Native Manifest 校验；
- 原生目录 / 媒体文件选择；
- 增量媒体扫描、SHA-256 与 Rust `ffprobe`；
- 默认程序打开与资源管理器 / Finder 定位；
- Tauri App Config / App Local Data；
- Dev / Release identifier 隔离。

## V1-16 权限边界

Desktop 可以读取 `works / people / organizations / series / genres / tags / assets`，`media-files` 永远属于 Private Layer。

为了用户明确确认的 NFO Bootstrap Ingest，Native Writer 暂时允许写 Private：

```text
works / people / organizations / series / genres / tags / media-files
```

但边界不是“Webview 传一个目录就写”：Rust 会自己读取当前 Desktop Settings 中配置的 `libraryPath`，所以写目标只能是 Private Library，Shared Pack 不能借用 Writer 写入。

另外：

- `assets` 仍不可通过该 Writer 写入；
- Canonical Entity 删除仍关闭；
- `delete_library_entity` 只允许删除 Private `media-files`；
- NFO 导入已有 Work 只能 fill / merge，不静默覆盖已有核心事实。

完整 Evidence / Review / Curation / History、冲突编辑、Media Binding 审计与 Portable Pack 完整交互继续属于 V1-17；不要在 Desktop 侧复制一套 Next.js/Node 实现。

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
- `docs/development/v1-16-independent-nfo-library-ingest-walkthrough.md`
