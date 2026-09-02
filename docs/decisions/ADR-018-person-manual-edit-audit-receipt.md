# ADR-018：人物手工编辑必须生成 before/after 审计 Receipt

## 状态

Accepted · V1-08

## 决策

私人 Library 中任何通过 Web 编辑器发生的 Person 修改，都必须：

1. 服务端校验；
2. 写 Canonical Person；
3. 保存 before/after PersonEditReceipt；
4. Receipt 写入失败时尝试补偿恢复 before-image。

## 原因

手工编辑不应该成为绕过 Provenance/History 思想的“后门”。

## 限制

V1-08 尚未提供 Person 字段级 Provenance 和一键恢复；Receipt 先保证修改前后有审计依据，未来可演进到统一 Entity History。
