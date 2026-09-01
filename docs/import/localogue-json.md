# Localogue JSON

Localogue JSON 是 V1 的主要原生交换格式，也是 V1 Canonical Library 的持久化基础。

## 要求

- 必须含 `schemaVersion`；
- 稳定 ID 与显示名称分离；
- 日期允许精度信息；
- 多语言值不可互相覆盖；
- 枚举使用受控词表 ID；
- 关系尽量使用内部 ID；
- 未解析 Raw Term 可单独保存。

示例见 `examples/works/ABC-123.json` 与 `examples/people/person_example_001.json`。

未来正式 JSON Schema 将放在 `schemas/`。
