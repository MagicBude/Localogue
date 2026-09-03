# Source Genre Catalog

V1-22 引入 `resources/vocabularies/source-genre-catalog.{csv,json}`，来源于人工整理的跨站 Genre 对照表。

## 规模

- 1271 条来源词条；
- 每条均包含日文、简体中文、繁体中文、英文；
- 保留来源站点、来源 URL/ID 与人工 note；
- 当前数据来自 avsox / javbus / jav321 / javdb / javlib 等来源的交叉整理。

## 它是什么

它是 **Source Genre Localization / Reference Catalog**，用于：

1. 已存在 Genre 缺少当前 Metadata Language 名称时补充展示；
2. Vocabulary Audit 的 unmapped 词显示翻译与来源参考；
3. 人工决定是否新增 `import-term-mappings` 时提供候选名称与别名；
4. 后续 Provider 做来源 Genre 对齐时作为参考词典。

## 它不是什么

它 **不是 1271 条 Canonical Genre 的自动白名单**。

来源站点常把以下内容也放在 genre/tag 桶中：

- 画质与技术属性；
- 发行活动 / 奖项 / campaign；
- 厂商、载体、发行渠道；
- 作品类型；
- 真正的内容题材。

因此 Localogue 仍遵守：

```text
Source term
  ↓
Source Genre Catalog（翻译 / 参考）
  ↓
import-term-mappings（人工明确语义）
  ↓
Canonical Work Type / Genre / Tag / structural / source-only
```

只有 `import-term-mappings` 明确允许进入 Genre 的词，才会自动进入 Canonical Genre。

## 文件

- `resources/vocabularies/source-genre-catalog.csv`：便于人工维护；
- `resources/vocabularies/source-genre-catalog.json`：程序使用；
- `src/application/services/genre-localization-service.ts`：展示层查找与语言补全；
- `docs/vocabulary/import-term-mappings.md`：真正决定 Canonical 语义的映射协议。

## 语言回退

Genre 展示优先级：

1. Canonical Genre 自身当前语言；
2. Source Genre Catalog 精确名称匹配后的当前语言；
3. Canonical Genre 的其他可用语言；
4. Stable ID。

这能修复“中文 Metadata Language 下 Genre 因缺少 zh-CN 名称而显示英文”的问题，同时不会修改原始 Canonical JSON。
