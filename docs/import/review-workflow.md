# Review 审核流程

Review 是 Localogue 的资料治理核心，而不是 Importer 的附属确认框。

## 当前 V1-07 完整链路

```text
External Metadata
      ↓
Importer
      ↓
Evidence（不可变来源记录）
      ↓
Evidence Lifecycle = pending
      ↓
Entity Resolution
      ↓
Field Comparison
      ↓
Review Decisions
      ↓
Commit Plan
      ↓
fingerprint 复核
      ↓
Canonical Snapshot
      ↓
Canonical Commit
      ↓
Field Provenance
      ↓
Lifecycle = committed
      ↓
Commit Receipt / History
```

如果用户决定暂时不处理：

```text
pending → ignored
```

Evidence 本身不会被删除或重写。

## 单项审核

至少展示：

- 当前 Canonical 值；
- 本次 Evidence 值；
- 来源；
- 字段差异；
- 实体匹配状态；
- 明确的字段和实体决策。

操作包括：

- 保留现有；
- 采用 Evidence；
- 新建实体；
- 关联已有实体；
- 跳过来源值；
- 忽略整条 Evidence。

## 安全边界

- ambiguous / unresolved 没有自动默认绑定；
- ignored Evidence 不能 Commit；
- Demo Library 不能正式写入；
- Commit 前必须生成 Plan；
- 执行前必须重新验证 fingerprint；
- Commit 前必须创建 Snapshot；
- 成功历史不能直接删除，只能通过受控 Restore 产生新的历史事件。

## 批量审核

尚未实现。V1-08 开始考虑批量治理，但必须复用同一套 Review Decision / Commit Plan 规则，不得新增绕过单条安全边界的“批量强制覆盖”。
