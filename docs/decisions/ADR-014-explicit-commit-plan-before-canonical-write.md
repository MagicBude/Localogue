# ADR-014：正式写入前必须经过 Commit Plan

- 状态：Accepted
- 阶段：V1-06

## Context

Evidence 导入后，Localogue 已能发现已有作品、实体匹配和字段冲突。下一步需要允许用户把审核结果正式归档。

直接提供“确认导入”按钮会隐藏大量写入行为，也难以应对资料库在审核期间发生变化的情况。

## Decision

Canonical Library 的写操作必须经过：

1. Review Analysis；
2. Review Decisions；
3. Commit Plan；
4. 用户明确确认；
5. 服务端重新生成 Plan；
6. fingerprint 一致性检查；
7. Commit Executor。

默认 Demo Library 永远不允许 Canonical Commit；只有通过 `/settings` 或 `LOCALOGUE_LIBRARY_PATH` 显式配置私人 Library 后才启用。

## Consequences

优点：

- 写入内容透明；
- 可阻止过期计划；
- 易于增加日志、回滚、数据库事务；
- 大幅降低误覆盖风险。

代价：

- 导入步骤比“一键刮削”更多；
- V1 JSON 仍无法提供真正跨文件 ACID Transaction。
