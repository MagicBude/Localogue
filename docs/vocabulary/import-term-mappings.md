# 导入词条映射表

这个模块定义“外部来源的混合分类词”如何进入 Localogue Canonical。

很多 NFO / Provider 会把 **Series、Maker、Label、Work Type、Genre、媒体格式、分级、活动词甚至人物名称**塞进同一个 `<genre>` / `<tag>` 数组，因此 Localogue 禁止把来源数组直接复制到 `genreIds / tagIds`。

## Runtime 事实源

V1-25A 起，分类词项不再主要靠 TypeScript 硬编码。运行时读取：

- `resources/vocabularies/genres.json`
- `resources/vocabularies/work-types.json`
- `resources/vocabularies/genre-source-aliases.json`
- `resources/vocabularies/classification-term-aliases.json`
- `resources/vocabularies/source-only-classifications.json`

`import-term-mappings.{json,csv}` 保留结构字段与典型规则的可审计说明；大规模具体词项以以上 Vocabulary 数据文件为准。

程序入口：

- `src/application/importers/import-classification-normalizer.ts`

## 第一层：结构字段优先

| 来源词 | Localogue 目标 | 规则 |
|---|---|---|
| `系列: ALL NUDE` / `シリーズ: ...` / `Series: ...` | Series | 去前缀后进入 Series 解析 |
| `片商: ...` / `メーカー: ...` / `Maker: ...` | Maker | 结构关系，不是 Genre |
| `厂牌: ...` / `レーベル: ...` / `Label: ...` | Label | 结构关系，不是 Genre |
| `发行: ...` / `Publisher: ...` | Source-only | 当前不强行等同 Maker/Label |
| `标签: ...` / `タグ: ...` / `Tag: ...` | User Tag candidate | 只有明确 Tag 前缀才允许走 Tag 语义 |
| 番号前缀 | Source-only | 不是 Genre |
| 演员 / 导演名称 | Person relation | 不是 Genre / Tag |

结构关系先排除，防止 `Series/Maker/Person` 被错误创建成 Genre。

## 第二层：受控分类

剩余来源词依次尝试：

1. explicit `classification-term-aliases`；
2. Provider `genre-source-aliases`；
3. Canonical Work Type 名称/别名；
4. Canonical Genre 名称/别名；
5. Source-only Classification。

匹配使用规范化后的**精确匹配**，不使用模糊字符串相似度自动写库。

## Work Type 示例

| Raw Term | Stable ID |
|---|---|
| `単体作品` / `Solo` | `solo` |
| `共演作品` | `co_starring` |
| `VR` / `VR作品` | `vr` |
| `イメージビデオ` | `image_video` |
| `総集編` | `compilation` |
| `オムニバス` | `omnibus` |
| `アダルトアニメ` | `adult_animation` |
| `4時間以上作品` | `over_four_hours` |

完整集合以 `work-types.json` 为准。

## Genre 示例

| Raw Term | Stable ID |
|---|---|
| `制服` | `uniform` |
| `スレンダー` | `slender` |
| `巨乳` | `big_bust` |
| `コスプレ` | `cosplay` |
| `中出し` | `creampie` |
| `主観` | `pov` |
| `ハメ撮り` | `pov_recording` |

`主観` 与 `ハメ撮り` 在 V1-25A 明确分开：前者表达 POV 观看视角，后者表达第一人称/自拍式拍摄方式。

## Source-only 示例

已认识但不属于当前 Genre / Work Type 的词不会再算 Unknown，也不会污染 Canonical：

```text
デビュー作 / 引退作 / 復帰作
DVD / Blu-ray / Full HD / 4K UHD
R-15 / R-18
ハイビジョン
Provider bonus / sample / marketing bucket
```

这些词进入 `structuralTerms` / Evidence，未来如果 Domain 增加专门字段可以再迁移。

## Review Required

复合词若一个原始字符串包含多个不同 Canonical 概念，Localogue 不替用户猜：

```text
寝取り、寝取られ
→ netori | netorare
→ review-required

女装・男の娘
→ cross_dressing | feminine_boy
→ review-required

ベスト、総集編
→ best_of | compilation
→ review-required
```

明确可安全拆分的复合词可以登记多目标 approved 规则；否则保持 audit-visible/unmapped。

## Unknown / Unmapped

找不到明确映射时：

```text
Raw Source Term
→ unmappedTerms
→ Evidence / Review
```

禁止：

```text
未知词
→ 自动新建 genre_xxx
```

也禁止 AI / fuzzy match 未经审核直接写 Canonical。

## 为什么 Source `<tag>` ≠ Localogue Tag

Localogue Tag 是用户自己的整理标签。来源 NFO `<tag>` 经常只是刮削器复制出来的分类桶，因此不能自动等同用户 Tag。

只有明确 `标签:` / `タグ:` / `Tag:` 结构语义，或未来用户审核确认，才进入 Tag。

## 覆盖率检查

对来源 substitution / taxonomy 文件使用：

```bash
pnpm vocabulary:coverage -- path/to/file.txt
```

报告会区分：Genre / Work Type / Source-only / safe multi-target / Review Required / Unmapped。

## 修改要求

新增或调整词项时：

1. 优先更新对应 `resources/vocabularies/*.json`；
2. 同步 CSV 镜像；
3. 需要复合词决策时更新 `classification-term-aliases.*`；
4. Provider 稳定分类 ID 才进入 `genre-source-aliases.*`；
5. 更新相关文档；
6. 运行 `pnpm validate:vocabulary`；
7. 必要时用真实来源表运行 `pnpm vocabulary:coverage`。

禁止只在某一个 Importer 中添加临时 hardcoded mapping。
