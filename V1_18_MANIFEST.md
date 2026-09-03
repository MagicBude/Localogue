# V1-18 Manifest — Desktop Presentation Parity & Unified Library Sync

## 目标

修复 V1-17 在真实 Desktop 使用中的两个缺口：本地 Asset 已能导入但无法真正渲染，以及媒体/NFO/图片需要分别操作导致资料库容易处于半同步状态；同时对齐 Web Works 的海报墙、列表、表格三种展示方式。

## 新增能力

- Desktop Works：海报墙 / 列表 / 表格三视图；
- Work poster 实际读取并显示；
- Work Detail 首图与关联 Asset 图片预览；
- Rust `read_private_asset_bytes` 受限图片读取命令；
- React `DesktopAssetImage` Blob URL 生命周期管理；
- Media 页面“一键同步 Unified Library”；
- 同步顺序固定为 NFO → Asset → Media；
- 保留“仅扫描视频”和“NFO + 图片 Preview / Import”高级入口。

## 安全边界

- 不为动态资料库开启宽泛 asset protocol scope；
- WebView 不能传入任意绝对路径读取文件；
- Native Reader 只能访问当前 Private Library 的 `asset-files/`；
- 禁止路径穿越并 canonicalize 检查符号链接边界；
- 限制图片扩展名、大小并校验 magic bytes；
- Shared Pack 继续只读。

## 主要文件

- `apps/desktop/src/desktop-asset-image.tsx`
- `apps/desktop/src/desktop-work-results.tsx`
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/tauri-bridge.ts`
- `apps/desktop/src/styles.css`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src-tauri/permissions/desktop-runtime.toml`
- `scripts/validate-desktop-boundaries.mjs`
- `docs/decisions/ADR-034-private-asset-ipc-and-unified-library-sync.md`
- `docs/development/v1-18-desktop-presentation-parity-and-unified-sync-walkthrough.md`

## 验收重点

- Unified Root 一键同步后 Asset 计数不再固定为 0；
- `*-poster.jpg` 能在 Works 海报墙显示；
- 三种 Works 视图共享同一查询结果；
- Work Detail 显示真实本地图片；
- Native Reader 无法越过 Private `asset-files/`；
- 既有 NFO / CRUD / Shared Pack / Media bind 功能保持可用。

## 后续

V1-19 再继续 Desktop Evidence / Review / Curation / History、完整高级 Facet、Portable Pack 等治理与功能对齐。V1-18 不把这些重治理能力声明为已完成。
