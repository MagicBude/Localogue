# 受控词表

受控词表用于解决“同一概念在不同来源中名字不同”的问题。

例如外部来源可能出现：

- `単体作品`
- `単体`
- `solo`
- `单体作品`

Localogue 内部统一映射到稳定 ID：

```text
solo
```

显示时再根据语言取：

- 日本語：単体作品
- 简体中文：单体作品
- English：Solo

## 原则

- ID 使用稳定英文标识，不随翻译变化；
- 日 / 中 / 英三语展示文本可以调整；
- Raw Term 不能因为未识别而丢弃；
- 词表可逐步扩展，不追求 V0 一次穷举所有行业术语；
- 文档表格用于人阅读；
- [导入词条映射表](import-term-mappings.md) 规定 NFO / 外部来源混合分类如何进入 Series / Work Type / Genre / Tag；
- `resources/vocabularies/` 中的 JSON 用于未来程序读取。
- [Review 字段决策](review-field-decisions.md)
- [实体审核动作](entity-review-actions.md)
- [Evidence 生命周期状态](evidence-lifecycle-statuses.md)
- [Provenance 事件类型](provenance-event-types.md)

## V1-08 新增

- `completeness-levels`：完整度分数对应的治理等级；
- `duplicate-confidence-levels`：重复候选用于排序和提示的置信级别。

两者都只表达治理信号，不表达“资料正确”或“已经确认重复”。

- [Approved Genre Source Aliases](./genre-source-aliases.md)：从外部参考表中人工筛选的来源别名；只允许指向现有 Canonical Genre。
