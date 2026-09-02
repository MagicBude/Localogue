# ADR-029：Desktop 复用 Media Scan Application Core

## 状态

已接受，V1-14。

## 决策

Tauri Desktop 不在 Rust 或 React UI 中重写扫描业务规则。Rust 只实现受限的平台与持久化 Commands，TypeScript Adapter 把它们实现为 V1-12 已冻结的 Platform Ports；扫描继续由 `MediaScanCoordinator` 与 `scanMediaLibrary` 执行。

Desktop Repository 进一步缩小为扫描专用能力：读取 `works`，读写 `media-files`。人物、组织、审核、Canonical Commit 等治理写入仍不暴露给 Webview。

## 原因

这样能让 Web 与 Desktop 对 unchanged fast path、人工绑定保护、sidecar observation、analysis stale、prune 和取消保持同一语义，同时把本机权限限制在实际需要的范围内。

## 后果

- Desktop Webview 会加载共享 Application / Domain TypeScript；
- 原生长 IO 在返回前无法被 JavaScript 强制中止，但 Adapter 会在调用前后检查 AbortSignal；
- V2 SQLite 可替换 Repository Adapter，而无需重写扫描核心；
- ffprobe 二进制发行仍需独立完成 target-triple、许可与完整性流程。
