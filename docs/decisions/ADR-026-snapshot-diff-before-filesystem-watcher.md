# ADR-026：Snapshot Diff 是扫描基线，Filesystem Watcher 只是增强

## 状态

Accepted · V1-12

## 决策

本地媒体同步的可靠基础使用磁盘 Snapshot 与现有 MediaFile 状态比较。

未来 Filesystem Watcher 只能用于提升实时性，不能成为唯一同步真相。

## 原因

Watcher 无法可靠覆盖：

- 应用关闭期间变化；
- NAS 短暂断线；
- USB 拔插；
- Watcher 丢事件或重启。

## V1-12 Fast Path

`fileSize + fileModifiedAt` 未变化时跳过昂贵媒体分析。

Sidecar Snapshot 独立比较，允许 NFO / Poster/Fanart 单独变化。
