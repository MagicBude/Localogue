# V1-21 覆盖包说明

覆盖 V1-20 后运行：

```bash
pnpm install
pnpm check
pnpm desktop:rust:check
pnpm desktop:dev
```

重点验收：

1. Works 的 Tag / Genre / Series Facet 不再同时出现大量 `系列: ...` 污染项；
2. Media 页面新增“分类词表审计”，先点“检查分类”查看历史 NFO 分类修复预览；
3. 预览确认后再点“应用修复”，只自动处理早期 NFO 生成的 `genre_nfo_* / tag_nfo_*` 引用，不自动删除用户手工 Tag；
4. `系列: XXX` 路由到 Series，`单体作品 / イメージビデオ / VR` 等路由到 Work Type；
5. 只有受控 Genre 映射自动进入 Canonical Genre；未知来源词保留为 unmapped，不再静默创建 Genre / Tag；
6. Work Detail 的“分类与标签”分开展示作品类型 / Genre / Tag 的真实名称；
7. Work 编辑器可以显式维护 Work Type；
8. V1-20 Sidebar / Facet / 中日英 i18n 与 V1-18 Hotfix 3 Unified Library / Native I/O 继续正常。

正式来源词映射表：

- `docs/vocabulary/import-term-mappings.md`
- `resources/vocabularies/import-term-mappings.json`
- `resources/vocabularies/import-term-mappings.csv`

以后新增或修改来源词映射时，代码、JSON、CSV 和文档必须同步更新。

V1-21 不修改 Canonical Schema，也不修改已通过 Windows 实机验证的 Rust Unified Library / Asset Native I/O 扫描核心。Evidence / Review / Curation / History / Restore / Portable Pack 完整治理进入 V1-22。
