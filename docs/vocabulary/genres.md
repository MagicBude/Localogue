# Genre 受控词表

Genre 是 Localogue 的**内容题材 / 角色 / 服装 / 体型 / 行为 / 玩法等可复用内容分类**，不等于来源网站所有名为 `genre` / `tag` 的分类桶。

V1-25A 将主仓库原有 33 个稳定 Genre ID 与 `localogue-community-data` 的 323 条 Classification Crosswalk、两份 MetaTube 日文分类参考表系统性合并；V1-25B 再根据 FANZA 2026 Provider Snapshot 补入一批此前确实缺失的稳定概念。当前主仓库维护 **359 个 Canonical Genre**：

- `resources/vocabularies/genres.json`
- `resources/vocabularies/genres.csv`

旧有 33 个 ID 与显示名称继续保留，避免已经写入 Private Library 的 `genreIds` 因词表扩充失效。Community / MetaTube 中不同写法通过 Alias 识别，不通过改 ID 解决。

## Facet 元数据

Canonical Genre 可以带一个或多个治理 Facet：

- `theme`：主题；
- `role`：角色 / 身份；
- `wardrobe`：服装；
- `body`：体型与外观；
- `act`：行为；
- `practice`：玩法与偏好。

当前 Work 关系仍然只保存稳定 `genreId`，Facet 暂时用于治理和后续 UI 演进。若 Community 中同一个精确词在多个 Facet 重复，但来源字符串无法区分，Localogue 合并到一个稳定 Canonical ID 并记录多个 `facets`，而不是创建两个无法可靠匹配的重复 Genre。

## 不进入 Genre 的来源词

以下内容会被识别，但路由到其它维度或 Source-only：

- `単体作品` / `VR` / `イメージビデオ`：Work Type；
- `デビュー作` / `復帰作` / `記念作`：生命周期 Source-only；
- `Blu-ray` / `4K UHD` / `Full HD`：媒体格式 Source-only；
- `R-15` / `R-18`：评级 Source-only；
- 分类表中的 `主題` / `キャラクター` / `メディア` 等分段标题：taxonomy heading Source-only；
- Maker / Label / Series / Person：独立实体或关系。

## Raw Term 与审核

精确匹配顺序：

1. Canonical ID；
2. Canonical 日 / 中 / 英名称；
3. Approved Classification Alias；
4. Approved Provider Genre Alias。

未识别词继续进入 `unmapped` 审计。像 `寝取り、寝取られ`、`女装・男の娘`、`ベスト、総集編` 这类来源把多个语义合在一个桶里的词，只登记为 `review-required`，不会自动同时写入多个 Canonical。
