# Genre 受控词表

Genre 是 Localogue 的**内容题材 / 表现主题**受控词表，不等于来源网站所有名为 genre/tag 的分类桶。

V1-22 Hotfix 3 根据实际 NFO 与用户提供的跨站参考表进行了保守扩充：只保留语义明确、适合作为内容题材筛选的项目。当前共 **33 个 Canonical Genre**，完整机器可读版本见：

- `resources/vocabularies/genres.csv`
- `resources/vocabularies/genres.json`

来源站的已批准同义词见：

- `resources/vocabularies/genre-source-aliases.csv`
- `resources/vocabularies/genre-source-aliases.json`

## 语义原则

适合进入 Genre 的例子：

- 人物/角色题材：制服、OL、人妻、熟女、女仆、护士、女教师；
- 身体/风格：巨乳、贫乳、苗条、美少女；
- 表现形式/主题：Cosplay、剧情、纪录片、女同性题材、主观视角；
- 明确内容行为：口交、自慰、潮吹、内射、接吻、乳交、骑乘位、手交、颜射、吞精、肛交、拘束、SM、偷窥等。

不应进入 Genre：

- `solo` / `VR` / `image_video`：Work Type；
- `デビュー作`：发行/生命周期属性；
- `周年`：活动/企划属性；
- `ハイビジョン` / `4K` / `Blu-ray`：技术/载体属性；
- `有码`：发行/审查属性；
- 用户收藏、待补封面：Tag；
- 厂商、系列、演员、导演：已有独立实体或关系。

## Raw Term

未知来源词先进入 `unmapped` 审计，不允许猜测式创建 Canonical Genre。只有经过明确映射后才进入受控词表。
