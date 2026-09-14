# 存储演进

## V1：JSON

原因：

- 用户可直接打开查看；
- 易于 Git Diff；
- AI 易读；
- 容易手工排错；
- 快速验证产品模型。

## CSV / XLSX

用于批量交换，不作为唯一真相源。

## V2：SQLite（已开始）

当需要更大规模、高频组合筛选、聚合 Facet、FTS 和事务时迁移。

V2 采用两个数据库：公共只读 `catalog.db` 与私人可写 `local.db`。Shared Pack 是 Curated Catalog 的发布包，不再被描述为另一套 Canonical 数据库。详细决策见 ADR-046。

Desktop 对 `local.db` 的切换采用逐 Profile 门控。启动或切换 Profile 时先从 JSON 非破坏性迁移，再比较每个集合的 ID 与完整 JSON 内容；只有零差异时，Canonical、MediaFile、Presentation Preference、Evidence 和 Governance 审计集合才读取 SQLite。任何迁移失败或内容差异都会让该 Profile 继续读取 JSON，因此交换与恢复格式不会因为数据库切换而失去作用。

## 迁移要求

- Domain ID 稳定；
- 枚举 ID 稳定；
- JSON Schema 带 `schemaVersion`；
- 迁移前后页面 Query Model 不变；
- 提供可重复执行的迁移脚本；
- 不以 SQLite 行号作为跨版本永久 ID。
