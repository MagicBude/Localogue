# V1-22 覆盖包说明

覆盖 V1-21 后运行：

```bash
pnpm install
pnpm check
pnpm desktop:rust:check
pnpm desktop:dev
```

重点验收：

1. 在 Works 页面滚动到中段，勾选 / 取消任意 Facet，页面不再跳回顶部；
2. 在人物库、分类浏览中改变筛选也保持当前滚动位置；
3. 顶部主语言选择“简体中文 / 日本語 / English”时，UI 与 Metadata 默认一起切换；如需要“中文 UI + 日文 Metadata”，再使用第二个高级 Metadata Language 控件覆盖；
4. 中文 UI 中显示“题材 / 标签”，不再直接显示 Genre / Tag 英文业务标题；
5. Work Type Facet 显示“单体作品 / 写真影像 / VR …”等三语名称，不再显示 raw stable id；
6. Genre 若 Canonical 实体缺少当前语言，但能与 Source Genre Catalog 匹配，应从 1271 条参考表补全显示；
7. Work Detail 应变为高密度“左海报 + 右字段表”，作品类型、题材、标签与日期 / 演员 / 厂商 / 系列处于同一主信息区；
8. “分类词表审计”的 unmapped 词若命中 Source Genre Catalog，会显示当前元数据语言的参考名称，但不会自动晋升 Canonical Genre；
9. V1-18 Hotfix 3 Unified Library / Native I/O 扫描链继续正常。

新增 Genre 参考资料：

- `resources/vocabularies/source-genre-catalog.csv`
- `resources/vocabularies/source-genre-catalog.json`
- `docs/vocabulary/source-genre-catalog.md`
- `src/application/services/genre-localization-service.ts`

Source Genre Catalog 共有 1271 条，仅用于语言补全、审计与人工映射参考。真正自动进入 Canonical Genre 的来源词仍必须在 `import-term-mappings` 中明确批准。
