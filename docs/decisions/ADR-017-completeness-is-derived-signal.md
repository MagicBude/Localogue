# ADR-017：完整度是派生治理信号，不是 Canonical 真相

## 状态

Accepted · V1-08

## 决策

Work / Person 完整度不写入 Canonical Entity，而由当前实体和明确规则实时计算。

## 原因

- 权重未来会调整；
- 分数可随资料补全自动变化；
- 避免缓存分数与真实字段不一致；
- 完整度不是“正确度”。

## 结果

V1 使用 Application Service 实时计算；V2 如需性能缓存，只能把缓存视为可重建索引。
