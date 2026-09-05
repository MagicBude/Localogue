# Source-only Classifications

有些来源分类很有用，但 Localogue 当前 Domain 没有对应的独立字段，或者它们本来就不应该成为 Genre。对于这些词，Runtime 应当做到：

```text
识别到
→ 保留为来源 Evidence / structural term
→ 不创建 Genre
→ 不创建用户 Tag
```

V1-25A 当前维护 **38 个**已知 Source-only 分类。

其中 21 个直接来自 Community Data：

- 5 个 lifecycle：首次拍摄、出道、引退、复出、纪念；
- 13 个 media-format：DVD、Blu-ray、HD DVD、VHS、UMD、MicroSD、数字发行、Streaming、Download、4K UHD、Full HD、HD、SD；
- 3 个 content-rating：R-18、R-15、成人限定。

其余项目来自 MetaTube 参考中的明确非 Genre 分类，例如：

- region：亚洲、法国、韩国；
- marketing：话题作；
- production technique：色键、局部特写；
- provider-specific：MGS 附赠影像、Sample Video；
- generic source bucket：Normal / Sexy / Adult / Culture / Various Professions；
- age-coded source term：`ショタ`、`ロリ系`，只识别和保留来源，不自动提升为 Canonical Genre；
- content warning：药物相关来源词。

机器可读文件：

- `resources/vocabularies/source-only-classifications.json`
- `resources/vocabularies/source-only-classifications.csv`
