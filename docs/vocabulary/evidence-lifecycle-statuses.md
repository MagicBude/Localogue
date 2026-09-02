# Evidence 生命周期状态

Evidence 本体保存一次导入的原始证据，**不因为审核状态变化而被重写**。生命周期状态单独保存在 `evidence-lifecycle/`。

| ID | 日本語 | 简体中文 | English | 说明 |
|---|---|---|---|---|
| `pending` | レビュー待ち | 待审核 | Pending | 等待人工 Review |
| `committed` | コミット済み | 已归档 | Committed | 已完成 Canonical Commit |
| `ignored` | 無視 | 已忽略 | Ignored | 本次不处理，但 Evidence 仍完整保留 |

恢复一个 Commit Snapshot 后，对应 Evidence 会重新变为 `pending`，允许重新审核和再次归档。
