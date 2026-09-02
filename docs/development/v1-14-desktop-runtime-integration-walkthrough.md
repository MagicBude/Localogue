# V1-14 Desktop Runtime Integration 教材

## 一条扫描如何运行

1. React UI 保存与 Web 同语义的实例设置；
2. `MediaScanCoordinator` 建立单实例 Job 与 AbortController；
3. 共享 `scanMediaLibrary` 只调用 Platform Ports 和 LibraryRepository；
4. Tauri Adapter 将目录遍历、stat、ffprobe、文件 Hash 转成受限 Rust Commands；
5. TauriScanRepository 读取 Private Library 的 works / media-files，并原子替换变化的 MediaFile JSON；
6. Job Snapshot 驱动 Desktop 进度与结果统计。

## 为什么 Repository 不是通用 JSON API

如果 Webview 可以指定任意集合或任意相对路径，最小权限边界就会消失。V1-14 Rust 端再次校验集合名，只有 `works` 与 `media-files` 可以访问；TypeScript 端只提供扫描核心需要的方法。

## 为什么完整文件 Hash 在 Rust

Webview 不应把大视频整体读入内存。Rust 按 1 MiB 缓冲区流式读取并计算 SHA-256。普通扫描默认关闭高成本文件 Hash，仍使用 fileSize + fileModifiedAt 增量判断。

## 取消的边界

协调器通过 AbortSignal 阻止下一项工作，并在原生 Promise 返回后再次检查。V1-14 不会粗暴杀死正在执行的系统读取或 ffprobe；后续若需要更细粒度取消，应设计带 task id 的 Rust Job，而不是开放通用进程终止权限。

## ffprobe 管理

解析顺序是：用户显式路径 → 应用旁 `resources/bin/ffprobe` → PATH。无论来自哪里，可执行文件名都只能是 ffprobe/ffprobe.exe，参数仍由 Rust 固定数组构造。源码覆盖包不携带第三方二进制。
