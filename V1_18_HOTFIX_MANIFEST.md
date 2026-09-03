# V1-18 Hotfix Manifest — Unified Library Scan Stack Overflow

## 触发症状

Windows Desktop 在执行“同步资料库”时进程突然退出，终端报告：

```text
thread 'main' has overflowed its stack
STATUS_STACK_OVERFLOW (0xc00000fd)
```

## 修复

- `walk_files` 改为 async Tauri Command；
- 阻塞目录 I/O 通过 `tauri::async_runtime::spawn_blocking` 放入 worker；
- `VecDeque` 迭代遍历代替 `WalkDir`；
- canonical path visited 集合防重复遍历；
- Windows 明确跳过 symlink / junction / reparse point；
- 100000 目录安全上限；
- 不可读目录与条目跳过并输出诊断；
- 每轮 `walk_files` 输出 root、文件数和目录数，便于继续定位。

## 不变项

- 产品版本保持 `0.1.18`；
- Unified Root 设置不变；
- 同步顺序仍为 NFO → Asset → Media；
- NFO / Asset / MediaFile Schema 不变；
- Works 三视图与 Private Asset Reader 不变；
- Shared Pack 仍只读。

## 本机验收

```bash
pnpm check
pnpm desktop:rust:check
pnpm desktop:dev
```

打开 Media，重新点击“同步资料库”，确认不再退出，并观察终端 `walk_files start/completed` 日志。
