# V1-18 Hotfix 3 Manifest — Native I/O Stack Safety

## 触发症状

Windows 实机已经强制 `cargo clean` 并重新编译 Hotfix 2，但在执行 Unified Library 同步时仍会直接退出：

```text
thread 'main' has overflowed its stack
STATUS_STACK_OVERFLOW (0xc00000fd)
```

这证明问题并非旧 binary 缓存，也不能只归因于目录递归。

## 确认到的高风险根因

Rust `sha256_path()` 原实现包含：

```rust
let mut buffer = [0_u8; 1024 * 1024];
```

这会在当前 Native Command 所在线程栈上一次性放置 1 MiB 固定数组。V1-18 一键同步第一次真正进入 poster / fanart / thumb 导入时，会执行：

```text
import_private_asset_file
  -> sha256_path
  -> 1 MiB stack allocation
```

Windows GUI / Tauri main thread 的可用栈并不适合这种大局部数组；再叠加 IPC、serde、路径处理等调用帧后，可直接触发 `STATUS_STACK_OVERFLOW`。

此外，V1-18 一键同步会连续执行大量 `read_nfo_text / write_library_entity / import_private_asset_file / read_library_collection` Native Invoke。为避免同步阻塞命令在 WebView/Tauri 主线程形成高频重入链，本 Hotfix 同时把高频文件 I/O 命令迁移到后台 blocking worker。

## 修复

- `sha256_path()` 改用堆分配的 256 KiB 流式缓冲：`vec![0_u8; 256 * 1024]`；
- 不再允许 Native SHA 路径出现 1 MiB 固定栈数组；
- `stat_path` / `path_exists` 改为 async + worker；
- `read_nfo_text` 改为 async + worker；
- `import_private_asset_file` 改为 async + worker；
- `read_private_asset_bytes` 的文件 I/O 改为 async + worker；
- `sha256_file` 改为 async + worker；
- `read_library_collection` 改为 async + worker；
- `write_library_entity` / `write_private_audit_entity` / `delete_library_entity` 改为 async + worker；
- `ffprobe` 进程等待也移入 blocking worker；
- 新增 `native_io #N <command> queued/start/ok/error` 终端诊断；
- Desktop “仅扫描视频”在 `observeImageSidecars=false` 时只请求视频扩展名，不再把 NFO 混入媒体 discovery response；
- Hotfix 1/2 的 `VecDeque` 迭代目录扫描、Windows junction/reparse 防环与特殊卷兼容性全部保留。

## 回归保护

`validate-desktop-boundaries.mjs` 新增：

- 禁止恢复 `[0_u8; 1024 * 1024]` 等超大固定 Native 栈缓冲；
- 要求 SHA-256 使用堆缓冲；
- 要求高频 Native 文件 I/O Command 保持 async；
- 要求后台 `spawn_native_io` 边界存在。

## 不变项

- 产品版本仍为 `0.1.18`；
- Library Schema / Work / Asset / MediaFile 格式不变；
- Unified Library NFO -> Asset -> Media 顺序不变；
- 原始视频、NFO、图片不移动不删除；
- Shared Pack 继续 Native 强制只读；
- V1-19 功能路线不受本稳定性 Hotfix 占用。

## 本机验收

```bash
cargo clean --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm desktop:rust:check
pnpm desktop:dev
```

先点击“同步资料库”。终端应能看到后台 I/O 日志，例如：

```text
[Localogue Desktop] native_io #1 walk_files queued
[Localogue Desktop] native_io #1 walk_files start worker=ThreadId(...)
[Localogue Desktop] native_io #1 walk_files ok worker=ThreadId(...)
[Localogue Desktop] native_io #... import_private_asset_file start worker=ThreadId(...)
[Localogue Desktop] native_io #... import_private_asset_file ok worker=ThreadId(...)
```

如果仍然异常，最后一条 `native_io` 日志将直接指示发生在 discovery、NFO、Asset、Canonical 写入还是 Media 分析阶段。
