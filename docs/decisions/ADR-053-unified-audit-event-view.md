# ADR-053：统一审计事件语义，分阶段迁移物理存储

## 状态

已接受（2026-09-14，第一阶段）。

## 问题

当前审计记录按业务用途分散保存：`evidence`、`evidence-lifecycle`、`review-commits`、`snapshots`、`restore-receipts`、`provenance`、`person-edits`、`media-binding-receipts`、`media-scan-history` 和 `asset-deletion-receipts`。这些集合各自有必要的字段和恢复语义，但页面因此需要知道很多物理集合名称。

## 决策

统一审计分成两层：

1. 业务 Receipt / Evidence 继续保留原集合，作为恢复、冲突判断和领域约束所需的结构化记录；
2. 增加统一的只读 Audit Event 视图，使用稳定字段表达：`id`、`eventType`、`subjectType`、`subjectId`、`occurredAt`、`actor`、`sourceCollection`、`summary` 和 `payloadRef`。

第一阶段只统一查询和展示语义，不把所有记录强行复制成第二份可写事实。SQLite Adapter 可以从现有集合生成事件视图，JSON Adapter 也使用相同的映射规则。原始 Receipt 仍然是恢复操作的权威记录。

第二阶段再根据实际查询量决定是否建立 SQLite `audit_events` 投影表；投影必须可由原始集合重建，不能成为唯一不可恢复的真相来源。

## 事件类型

至少覆盖：`evidence_imported`、`evidence_committed`、`evidence_ignored`、`person_edited`、`media_bound`、`media_unbound`、`asset_deleted`、`scan_completed`、`snapshot_created`、`restore_completed`。

## 原因

用户需要按时间和对象理解“发生了什么”，而恢复逻辑需要完整的领域 Receipt。统一查询模型能减少 UI 对文件集合的耦合，同时保留现有失败补偿和审计不可删除规则。

## 后续实现顺序

先定义共享 `AuditEvent` 类型和集合到事件的纯映射；再为 Web/Desktop Repository 增加 `listAuditEvents`；最后才考虑 SQLite 投影。迁移期间禁止删除或改写已有 Receipt。
