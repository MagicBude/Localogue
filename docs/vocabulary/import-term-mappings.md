# 导入词条映射表

这个表定义“外部来源的混合分类词”如何进入 Localogue Canonical。

它尤其用于 NFO。很多刮削器会把 **Series、Maker、Work Type、Genre、技术标签和活动词**同时塞进 `<genre>` 与 `<tag>`，因此不能把来源数组直接复制到 Canonical `genreIds / tagIds`。

程序侧镜像：

- `resources/vocabularies/import-term-mappings.json`
- `resources/vocabularies/import-term-mappings.csv`（必须与 JSON 逐条镜像）
- `src/application/importers/import-classification-normalizer.ts`

## 结构字段

| 来源词 | Localogue 目标 | 规则 |
|---|---|---|
| `系列: ALL NUDE` / `シリーズ: ...` / `Series: ...` | Series | 去掉前缀后进入 `seriesIds` |
| `片商: Aircontrol` / `メーカー: ...` / `Maker: ...` | Maker | 只在 NFO 没有明确 Maker 时作为 fallback |
| `厂牌: ...` / `レーベル: ...` / `Label: ...` | Label | 只在没有明确 Label 时作为 fallback |
| `发行: ...` / `配給: ...` / `Publisher: ...` | Source-only | 当前模型不强行等同 Maker/Label，不进入 Genre/Tag |
| `标签: ...` / `タグ: ...` / `Tag: ...` | Tag | **只有明确 Tag 前缀**才允许来源自动创建 Tag |
| 番号前缀（如 `OAE`、`MIDV`） | Source-only | 番号族不是 Genre |
| 演员 / 导演名称 | Person relation | 人名不是 Genre/Tag |

## Work Type

| Raw Term 示例 | Stable ID |
|---|---|
| `単体作品` / `单体作品` / `Solo` | `solo` |
| `共演作品` / `共演` | `co_starring` |
| `VR` / `VR作品` | `vr` |
| `イメージビデオ` / `写真影像` | `image_video` |
| `総集編` / `合辑` | `compilation` |
| `オムニバス` / `单元合集` | `omnibus` |
| `ベスト` / `精选集` | `best_of` |

Work Type 描述作品形式，不应出现在 Genre 或 Tag。

## Genre

只有命中 [Genre 受控词表](genres.md) 的来源词才自动进入 Canonical Genre。例如：

- `制服` → `uniform`
- `スレンダー` → `slender`
- `巨乳` → `big_bust`
- `コスプレ` → `cosplay`
- `ドキュメンタリー` → `documentary`

完整初始集合以 `resources/vocabularies/genres.json` 为准。

## Unknown / Unmapped

例如：

- `Blu-ray（ブルーレイ）`
- `有码`
- `FANZA7周年キャンペーン`
- 某来源自己的活动名、技术规格或模糊分类

如果当前没有明确 Canonical 维度，**不得为了“不丢数据”就创建 Genre 和 Tag**。

它们应保持为 `unmapped source term`，由后续 Vocabulary Review / Governance 决定：

1. 新增受控 Genre；
2. 新增 Work Type；
3. 增加新的 Domain 字段；
4. 明确映射为 Tag；
5. 保持 Source-only。

## 为什么 Tag 不再照单全收

Localogue 的 Tag 定义是“用户自己的整理标签”。来源 NFO 的 `<tag>` 往往只是刮削器复制出来的分类桶，不能自动等同用户标签。

所以：

> Source `<tag>` ≠ Localogue Tag。

只有 `标签:` / `タグ:` / `Tag:` 这种明确语义，或未来 Review 中用户确认的映射，才进入 Canonical Tag。

## 修改要求

以后新增导入映射时必须同时更新：

1. `src/application/importers/import-classification-normalizer.ts`；
2. `resources/vocabularies/import-term-mappings.json`；
3. `resources/vocabularies/import-term-mappings.csv`；
4. 本文档；
5. 对应的自动校验 / 测试。

禁止只在某一个 Importer 中硬编码临时映射。
