# Provenance 事件类型

| ID | 日本語 | 简体中文 | English | 含义 |
|---|---|---|---|---|
| `adopted` | Evidence 採用 | 采用 Evidence | Evidence adopted | 某次 Canonical Commit 采用了 Evidence 并改变字段 |
| `restored` | Snapshot 復元 | 快照恢复 | Snapshot restored | 通过恢复 Snapshot 让字段回到提交前值 |

Provenance 使用**追加事件**而不是覆盖当前来源，因此可以追踪同一字段的完整历史。
