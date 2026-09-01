# V2 SQLite 迁移

SQLite 是 V2 的持久化升级，不是重新设计产品。

## 迁移目标

- Domain Model 尽量不变；
- WorkQuery / PersonQuery 尽量不变；
- Repository 接口尽量不变；
- V1 的稳定 ID 保持；
- 所有 JSON 可重复导入 SQLite；
- CSV / XLSX / NFO 继续存在。

## SQLite 带来的能力

- 关系查询；
- 高效 Facet 聚合；
- 索引；
- 事务；
- FTS5；
- 更大资料量下的分页与排序。

## 不提前引入的原因

V0/V1 的主要风险是“产品和数据模型是否正确”，而不是数据库性能。先用可读 JSON 验证模型，可以降低学习和修改成本。
