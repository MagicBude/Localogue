# Localogue Desktop

V1-15 的 Tauri 2 Desktop Feature Parity I。

Desktop 已从 V1-13/V1-14 的 Runtime 验证壳升级为正式 Localogue 应用入口。它与 Next.js Web 共享 Domain / Application 规则，但使用 Tauri/Rust 作为本地平台适配层。

当前提供：

- Home / Works / People / Media / Packs / Settings 一级页面；
- Work / Person 详情与基础关系导航；
- `TauriLibraryRepository` 合并 Private Library 与 Shared Packs；
- Works / People 查询复用 Web 的 `library-query` 纯 Application Core；
- Shared Pack Native Manifest 校验；
- 原生目录 / 媒体文件选择；
- 增量媒体扫描、SHA-256 与 Rust `ffprobe`；
- 默认程序打开与资源管理器 / Finder 定位；
- Tauri App Config / App Local Data；
- Dev / Release identifier 隔离。

## V1-15 权限边界

Desktop 可以只读浏览 `works / people / organizations / series / genres / tags / assets`。`media-files` 永远属于 Private Layer，也是当前唯一允许 Webview 通过 Repository Command 写入的集合。Shared Pack 永远只读。

Canonical 编辑、Evidence/Review/Curation/History、Media Binding 与 Portable Pack 完整交互属于 V1-16；不要在 Desktop 侧复制一套 Next.js/Node 实现。

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

完整前置要求见：

- `docs/desktop/tauri-prerequisites.md`
- `docs/architecture/desktop-runtime.md`
