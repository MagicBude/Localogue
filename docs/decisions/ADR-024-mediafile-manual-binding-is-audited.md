# ADR-024：MediaFile 人工绑定必须显式并保留审计记录

## 决策

扫描器无法保守识别时保留 `workId = null`。人工绑定、改绑和解绑通过 Application Service 执行，并写入 MediaBindingReceipt。

## 原因

MediaFile→Work 虽然属于私人状态，但错误绑定会直接影响“我拥有哪些作品”、筛选和媒体治理。用户明确决策应该可追溯，而不是悄悄覆盖 JSON。
