# Genre 初始词表

Genre 是可扩展受控词表。V0 只提供常见初始集合，后续以实际资料为依据扩充。

| ID | 日本語 | 简体中文 | English |
|---|---|---|---|
| `uniform` | 制服 | 制服 | Uniform |
| `office_lady` | OL | OL / 职场女性 | Office Lady |
| `married_woman` | 人妻 | 人妻 | Married Woman |
| `mature` | 熟女 | 熟女 | Mature |
| `amateur` | 素人 | 素人 | Amateur |
| `big_bust` | 巨乳 | 巨乳 | Big Bust |
| `small_bust` | 貧乳 | 贫乳 | Small Bust |
| `slender` | スレンダー | 苗条 | Slender |
| `cosplay` | コスプレ | 角色扮演 | Cosplay |
| `drama` | ドラマ | 剧情 | Drama |
| `documentary` | ドキュメンタリー | 纪录 | Documentary |
| `lesbian` | レズ | 女同性题材 | Lesbian |
| `first_work` | デビュー作 | 出道作 | Debut Work |
| `anniversary` | 周年 | 周年企划 | Anniversary |
| `high_definition` | ハイビジョン | 高清 | High Definition |

## Raw Term

导入遇到未知词时，例如：

```text
sourceTerm = "某来源自己的分类名称"
```

先保留原值，标记 `unmapped`，经过人工映射后再关联到 Canonical Genre。

## 不应混入的内容

- `solo` / `vr` 等属于 Work Type；
- `favorite` / `待补封面` 等属于 Tag；
- `active` / `retired` 属于人物状态。
