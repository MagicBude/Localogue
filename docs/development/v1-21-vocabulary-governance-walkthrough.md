# V1-21 Vocabulary Governance 实现导读

V1-21 处理的是一个真实来源数据问题：很多 NFO 刮削器会把 Series、Maker、Work Type、Genre、技术规格和活动词同时写进 `<genre>` / `<tag>`。

如果直接把这些数组写入 Canonical，就会出现：

- Series 同时出现在 Series / Genre / Tag；
- `单体作品`、`イメージビデオ` 被错误当 Genre；
- 番号前缀、演员名、片商进入筛选 Facet；
- Tag 不再表示“用户自己的整理标签”。

## 新导入路径

`NfoMetadataImporter` 现在会先经过 `normalizeImportedClassifications()`：

1. 结构前缀路由；
2. Work Type alias 映射；
3. controlled Genre alias 映射；
4. 显式 Tag 前缀；
5. 未知词标记 `unmapped_classification`。

映射协议见：

- `docs/vocabulary/import-term-mappings.md`
- `resources/vocabularies/import-term-mappings.json`

## 历史数据修复

Desktop “本地资料”新增分类词表审计。

Preview 只检查 **Private Work** 中早期 Desktop NFO Bootstrap 生成的：

- `genre_nfo_*`
- `tag_nfo_*`

因此用户自己建立的 Tag 不会被自动改写；Shared Pack 也不会因为某个 ID 恰好匹配旧 NFO 前缀而被建立 Private Override。

应用修复后：

- Series 前缀迁移至 `seriesIds`；
- Work Type alias 迁移至 `workTypeIds`；
- 已知 Genre 迁移至稳定 controlled Genre ID；
- 未映射来源词不进入 Canonical；
- 旧 NFO Genre / Tag 在无引用后安全删除。

## Work Detail

Desktop 不再显示 `workTypeIds + genreIds + tagIds` 原始 ID token，而是分成三组并按 Metadata Language 显示真实名称。
