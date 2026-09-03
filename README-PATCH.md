# Localogue V1-18 Desktop Presentation Parity & Unified Library Sync 覆盖包

这是从 V1-17 升级到 V1-18 的完整仓库覆盖包。

本版重点修复实机验收中的两个缺口：

1. V1-17 即使导入 Asset，Desktop Works 仍然只显示占位符；
2. Media / NFO / 图片分开操作，容易形成“视频已扫描但 Asset 仍为 0”的半同步状态。

V1-18 新增：

- Works 海报墙 / 列表 / 表格三视图；
- Private poster / cover 实际本地渲染；
- Work Detail 首图和 Asset 图片预览；
- 受限 Rust `read_private_asset_bytes`，只允许读取当前 Private `asset-files/`；
- Media 页面“一键同步资料库”；
- 同步顺序固定为 NFO → Asset → Media；
- 保留仅扫描视频、NFO + 图片 Preview / Explicit Import 高级入口。

覆盖后运行：

```bash
pnpm install
pnpm check
pnpm desktop:doctor
pnpm desktop:rust:check
pnpm desktop:dev
```

建议真实验收：Settings 添加共同父目录 → Media 点击“同步资料库” → Asset 计数应增长 → Works 切换三种视图 → 检查 poster → 打开 Work Detail 检查关联图片。

V1-19 再继续 Evidence / Review / Curation / History、完整高级 Facet、Portable Pack 等 Desktop 重治理能力。
## V1-18 实机 Hotfix：Windows 同步资料库栈溢出

如果旧 V1-18 在“同步资料库”过程中出现：

```text
thread 'main' has overflowed its stack
STATUS_STACK_OVERFLOW (0xc00000fd)
```

本覆盖包已经把 Native `walk_files` 改成后台 worker 的显式迭代队列，并对 Windows junction / reparse point 做防环处理。

重新运行 `pnpm desktop:dev` 后，再点击“同步资料库”。终端会输出：

```text
[Localogue Desktop] walk_files start ...
[Localogue Desktop] walk_files completed ...
```

如果仍有异常，请保留最后一条 `walk_files` 日志；它可以直接定位是哪一个扫描根和哪一类文件触发问题。
## V1-18 Hotfix 2：Windows 卷 canonicalize OS 1005

如果第一版 Hotfix 点击“同步资料库”或“仅扫描视频”立即出现：

```text
无法解析资料扫描根路径：此卷不包含可识别的文件系统。 (os error 1005)
```

这次覆盖包已经移除“扫描前必须 canonicalize 整个根目录”的要求。Localogue 现在用 `metadata + read_dir` 判断扫描根是否真的可读；可读卷即使不支持 Windows canonical final path 也可以继续扫描。

目录环保护仍然保留：symlink 不跟随，junction / reparse 目录不下钻，扫描继续使用后台 worker + `VecDeque` 迭代队列。

建议先点击“仅扫描视频”确认出现 `walk_files completed`，再执行完整“同步资料库”。


## V1-18 Hotfix 3：Native I/O 栈安全

如果已经 `cargo clean` 并确认运行的是新 binary，但同步仍出现 `thread 'main' has overflowed its stack`，Hotfix 3 修复了 Asset SHA-256 路径中的 1 MiB 固定栈缓冲，并把高频文件 I/O Command 全部迁移到后台 worker。

覆盖后建议再次执行 `cargo clean --manifest-path apps/desktop/src-tauri/Cargo.toml`，再运行 `pnpm desktop:rust:check` 与 `pnpm desktop:dev`。同步时终端将显示 `native_io #N ...` 日志。
