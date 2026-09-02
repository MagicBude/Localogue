# ADR-016：最小 Snapshot 与最新提交优先恢复

## 状态

已接受。

## 背景

V1 JSON 没有跨文件事务，但 Canonical Commit 已经会同时修改多个实体文件。

## 决策

1. 每次 Commit 前创建本次涉及文件的最小 Snapshot；
2. Commit 中途失败时自动恢复 Snapshot；
3. 用户主动恢复时保留审计历史并增加 Restore Receipt；
4. 只允许恢复某 Work 当前最新的有效 Commit；
5. 若本次 Commit 创建的新实体已经被其他 Work 引用，则阻止恢复。

## 为什么不用每次全量复制 Library

全量 Snapshot 简单，但随着图片和数万作品增长会极度浪费空间。

最小 Snapshot 更接近数据库日志中的 before-image，也更适合作为学习模型。

## 局限

它仍然不是 SQLite Transaction。V2 会使用真正的事务保证原子性，但 V1 的 Commit History / Provenance / Restore 业务语义继续保留。
