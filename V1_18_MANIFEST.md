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
## Hotfix：Unified Library Scan Stack Overflow

实机验收发现 Windows 在“同步资料库”阶段可能直接以 `STATUS_STACK_OVERFLOW (0xc00000fd)` 退出。Hotfix 对 Native `walk_files` 做如下收紧：

- Tauri Command 改为 async，并使用 `spawn_blocking` 执行目录 I/O；
- 使用 `VecDeque` 显式迭代，不以目录深度消耗调用栈；
- canonical path `visited` 去重；
- Windows 子目录若为 symlink / junction / reparse point 则不跟随；
- 不可读目录只记录诊断并跳过；
- 增加终端 start/completed 日志和目录数量安全上限。

Hotfix 不改变 V1-18 数据模型、同步顺序或产品版本号。
## Hotfix 2：Windows Volume Scan Compatibility

第一版 Hotfix 在部分可正常 `read_dir` 的 Windows 卷上仍会因为 `fs::canonicalize(root)` 返回 OS 1005 而阻止扫描。第二版 Hotfix 调整为：

- 扫描根只要求 `metadata + read_dir` 可用，不再要求 canonical final path；
- visited 使用词法绝对路径 key；
- Windows symlink 不跟随，junction / reparse 目录不下钻；
- 普通 reparse 文件仍可以作为媒体/NFO/图片候选；
- 保持后台 worker、迭代队列、目录数量上限和所有数据模型不变。

Hotfix 2 同样保持产品版本 `0.1.18`。



## Post-release Hotfix 3 — Native I/O Stack Safety

V1-18 实机同步确认存在 Native 栈安全问题：`sha256_path()` 曾在调用栈放置 1 MiB 固定数组。Hotfix 3 改用 256 KiB heap buffer，并把高频 Native 文件 I/O/Canonical 写入迁移到 blocking worker。详细见 `V1_18_HOTFIX3_MANIFEST.md`。
