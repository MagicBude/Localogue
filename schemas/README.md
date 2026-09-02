# Schema 目录

本目录保存 Localogue V1 的**结构示例**。目前仍以 TypeScript Domain Model 为主要类型来源，示例用于人类阅读、AI 协作和未来正式 JSON Schema 的基础。

- `work.schema.example.json`：Canonical Work；
- `person.schema.example.json`：Canonical Person；
- `evidence.schema.example.json`：不可变的来源 Evidence；
- `evidence-lifecycle.schema.example.json`：Evidence 的待审核 / 已归档 / 已忽略状态；
- `commit-plan.schema.example.json`：正式写入前的只读 Commit Plan；
- `commit-receipt.schema.example.json`：正式归档后的 Commit Receipt，V1-07 起包含 operations 与 snapshotId；
- `canonical-snapshot.schema.example.json`：Commit 前最小 before-image；
- `restore-receipt.schema.example.json`：用户主动恢复 Snapshot 后的审计记录；
- `provenance.schema.example.json`：Work 字段级来源事件历史。

未来进入 V2 SQLite 后，这些结构会映射为数据库表、外键、事务和迁移，而不是被丢弃。


### V1-08
- `person-edit-receipt.schema.example.json`：人物手工编辑 before/after 审计记录示例。
