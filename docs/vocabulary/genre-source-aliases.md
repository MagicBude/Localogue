# Approved Genre Source Aliases

V1-22 Hotfix 3 不再保存用户提供的完整 `genre.csv` 副本。

那份参考表包含 1271 条跨站分类，既有真正的内容题材，也混有画质、发行活动、技术属性、渠道和其他站点特有维度，因此不能作为 Localogue Runtime 词表长期保留。

Localogue 只从参考表中**人工筛选并批准**能够明确映射到 Canonical Genre 的来源别名：

- `resources/vocabularies/genre-source-aliases.csv`
- `resources/vocabularies/genre-source-aliases.json`

当前共保留 **67 条来源别名**，指向 **33 个 Canonical Genre**。

## 边界

- 这不是完整来源分类表；
- 每条记录必须指向 `resources/vocabularies/genres.*` 中已经存在的 Canonical Genre；
- 来源别名只用于导入匹配和已有 Genre 的多语言 fallback；
- 未被选入的原始 `genre.csv` 条目不会进入仓库，也不会自动成为 Genre；
- 后续若要新增映射，先判断它是否真的是内容题材，再同步更新 `genres.*`、`genre-source-aliases.*`、`import-term-mappings.*` 与文档。

## 从参考表中明确排除的类型

例如以下条目不应因为来源网站将其放在 genre/tag 桶里就成为 Canonical Genre：

- `デビュー作`：作品生命周期/发行属性；
- `周年` / 各类活动：企划或发行事件；
- `ハイビジョン` / `4K` / `Blu-ray`：技术或载体属性；
- `有码`：发行/审查属性；
- 厂商、系列、演员、番号前缀：已有独立 Domain 维度。

这些信息可以保留为来源 Evidence 或后续建立专门字段，但不进入 Genre Facet。
