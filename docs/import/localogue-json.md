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

V1-24 起不再维护独立的 `examples/works/` / `examples/people/` 文档样例。Canonical 结构示例直接复用可运行 Dev Fixture：

```text
examples/dev-library/template/works/work_fixture_lx_101.json
examples/dev-library/template/people/person_fixture_aiko_mizuno.json
```

这样文档示例、Desktop 手工测试和未来 E2E 共用同一份稳定 ID / Schema，不会出现“两套示例各自演进”的漂移。

未来正式 JSON Schema 将放在 `schemas/`。
