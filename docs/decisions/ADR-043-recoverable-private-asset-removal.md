# ADR-043：Private Asset 使用可恢复移除流程

## 状态

已接受。

## 背景

作品与人物详情原先直接删除 Private Asset JSON。虽然原图和内容寻址管理副本仍在磁盘上，用户误点后仍会失去 Asset 元数据和主体关联，只能重新扫描或重新导入。

## 决策

删除入口改为“移入回收站”，并在 `asset-deletion-receipts/` 保存恢复所需的最小 before-image：完整 Asset、所属主体以及删除前存在的引用种类。

执行顺序固定为：

1. 先写 `pending` Receipt，保证后续动作已有恢复依据；
2. 解除 Work / Person 对 Asset 的引用；
3. 删除 Private Asset JSON；
4. 把 Receipt 标记为 `deleted`。

失败时应用服务尽力补回 Asset 与主体引用，并把 Receipt 标记为 `failed`。恢复时读取主体当前状态，只合并原有 Asset 引用，不用旧主体快照覆盖删除后的其它编辑。恢复完成后 Receipt 标记为 `restored`，审计记录继续保留。

图片二进制不随移除动作删除。孤儿管理副本仍由独立存储治理功能显式清理。

## 原因

V1 JSON Repository 不具备数据库事务。独立 Receipt 同时提供持久化撤销能力与补偿信息，也避免在 Canonical Asset 中加入 `deleted` 等工作流字段。
