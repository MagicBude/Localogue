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

## V2：SQLite

当需要更大规模、高频组合筛选、聚合 Facet、FTS 和事务时迁移。

## 迁移要求

- Domain ID 稳定；
- 枚举 ID 稳定；
- JSON Schema 带 `schemaVersion`；
- 迁移前后页面 Query Model 不变；
- 提供可重复执行的迁移脚本；
- 不以 SQLite 行号作为跨版本永久 ID。
