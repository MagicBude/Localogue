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
- 词表按 Provider / 参考数据覆盖持续扩展，不以“全世界永久完整”为目标；
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

## V1-25A / V1-25B Vocabulary Coverage

当前分类治理拆成五层：

- `genres.*`：359 个 Canonical Genre；
- `work-types.*`：43 个 Canonical Work Type；
- `source-only-classifications.*`：51 个可识别但不提升为 Canonical 的来源属性；
- `classification-term-aliases.*`：1161 个精确来源词，其中 1127 个可自动路由、34 个必须审核；
- `community-classification-crosswalk.*`：`localogue-community-data` 323 / 323 Classification 到 Localogue Runtime 维度的交叉映射。

辅助命令：

```bash
pnpm validate:vocabulary
pnpm vocabulary:coverage -- path/to/source-terms.txt
pnpm vocabulary:provider-coverage
pnpm validate:provider-coverage
```

Provider 快照与覆盖率规则见 [Provider Genre Coverage](./provider-coverage.md)。覆盖率报告用于发现未识别词，不会自动把未识别词创建成 Genre。

V1-25C 起，Provider ID 与名称 Evidence 分离：`genre-source-aliases.*` 的 `idSource` 才表示 `sourceId` 属于哪个 Provider；`sources` 只表示名称曾在哪些来源出现，不能据此复制 ID。
