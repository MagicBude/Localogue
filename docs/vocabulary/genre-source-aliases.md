# Approved Genre Source Aliases

V1-22 Hotfix 3 不再保存用户提供的完整 `genre.csv` 副本。

那份参考表包含 1271 条跨站分类，既有真正的内容题材，也混有画质、发行活动、技术属性、渠道和其他站点特有维度，因此不能作为 Localogue Runtime 词表长期保留。

Localogue 只从参考表中**人工筛选并批准**能够明确映射到 Canonical Genre 的来源别名：

- `resources/vocabularies/genre-source-aliases.csv`
- `resources/vocabularies/genre-source-aliases.json`

当前保留 **72 条 Canonical Genre 来源别名**。V1-25C 开始不再把 `sourceId` 与 `sources` 混为一谈：`idSource` 才是这个 ID 的 Provider 归属；`sources` 只表示该名称/翻译曾在哪些来源出现。当前 38 条 ID 已有明确 Provider 归属，其余 34 条旧 ID 以 `legacy-unscoped` 保留证据但不再冒充某个 Provider ID。V1-25B Canonical Genre 已扩展到 359 条；通用字符串 Alias 继续由 `classification-term-aliases.*` 维护。

V1-25B 另外新增 `resources/vocabularies/provider-genre-catalogs/`：它保存 Provider Coverage 的输入快照，可以包含尚未核实 ID 的真实 label，但不会因此自动进入本 Approved ID Alias 表。

## 边界

- 这不是完整来源分类表；
- 每条记录必须指向 `resources/vocabularies/genres.*` 中已经存在的 Canonical Genre；
- `idSource` 是 `sourceId` 的唯一 Provider 身份边界；只有经过 Provider 级证据确认后才能填写；
- `sources` 是 label / 翻译 / 历史参考的 Evidence 列表，**不能**据此推导 `sourceId` 在每个来源都有效；
- `idSource=null + idStatus=legacy-unscoped` 表示旧 ID 暂时只保留作历史证据，不参与 Provider ID 覆盖率声明；
- 来源别名只用于导入匹配和已有 Genre 的多语言 fallback；
- 未被选入的原始 `genre.csv` 条目不会进入仓库，也不会自动成为 Genre；
- 后续若有稳定 Provider 分类 ID，可继续写入本表；仅字符串别名优先写入 `classification-term-aliases.*`。两者都必须指向现有 Canonical，并通过 `pnpm validate:vocabulary`。
- `Generic` 表示**没有稳定 Provider/sourceId 的通用字符串别名**；它不属于 `genre-source-aliases.*` 的 Provider ID 映射边界，应进入 `classification-term-aliases.*`，避免把通用词伪装成某个来源的稳定分类 ID。

## 从参考表中明确排除的类型

例如以下条目不应因为来源网站将其放在 genre/tag 桶里就成为 Canonical Genre：

- `デビュー作`：作品生命周期/发行属性；
- `周年` / 各类活动：企划或发行事件；
- `ハイビジョン` / `4K` / `Blu-ray`：技术或载体属性；
- `有码`：发行/审查属性；
- 厂商、系列、演员、番号前缀：已有独立 Domain 维度。

这些信息可以保留为来源 Evidence 或后续建立专门字段，但不进入 Genre Facet。

## V1-25A / V1-25B / V1-25C 语义修正

`主観` 继续映射 `pov`；Provider sourceId `1g` 的 `ハメ撮り` 改为 `pov_recording`，避免把“主观视角”和“第一人称拍摄形式”继续合并成一个 Genre。


### V1-25C Provider ID 身份隔离

Round 1 曾把 `sources` 中出现 `javbus` / `javlib` 误读成“同一个 `sourceId` 也属于这些 Provider”，从而把 JAVDB 风格的 `tags?c3=...` 等 ID 复制进其它 Provider Catalog。V1-25C 明确拆开两种概念，并新增 Validator 阻止同一已归属 ID 被另一个 Provider Catalog 静默复用。

本轮还加入经公开 JAVBus 页面/文档直接核实的 Genre ID：`e=巨乳`、`3f=深喉`、`7i=孕ませ`、`4=中出`、`1y=其他戀物癖`、`6j=温泉`。`花癡`、`高畫質`、`單體作品` 虽同样有真实 JAVBus ID，但分别属于 Review / Source-only / Work Type，因此不会塞进 Canonical Genre Alias 表。
