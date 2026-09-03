# V1-21 Manifest · Vocabulary Governance & Work Metadata Visibility

## 目标

修复实机 NFO Bootstrap 暴露出的分类维度污染，并让 Desktop Work Detail 真实展示 Work Type / Genre / Tag，而不是内部 ID。

## 已完成

- 新增共享 `import-classification-normalizer`；
- NFO `<genre>/<tag>` 不再直接复制到 Canonical；
- `系列:` → Series；
- `单体作品 / イメージビデオ / VR...` → Work Type；
- 已知词 → 受控 Genre；
- 只有显式 `标签:/タグ:/Tag:` → Tag；
- Maker / Publisher / 番号前缀 / 人名不再污染 Genre / Tag；
- 未知来源词保留为 `unmapped_classification` warning，不自动创建 Canonical；
- 新增 `docs/vocabulary/import-term-mappings.md` 与 resources JSON/CSV 镜像；
- 新增 Desktop “分类词表审计” Preview → Explicit Repair；
- Repair 仅收口 **Private Work** 中早期 `genre_nfo_* / tag_nfo_*` 自动生成实体，不删除用户手工 Tag，也不因 Shared Pack 的相似 ID 创建 Override；
- Repair 可把历史混合词重新路由至 Series / Work Type / controlled Genre；
- 无引用的早期 NFO Genre / Tag 可由 Native 引用保护删除；
- Work Detail 分开展示作品类型 / Genre / Tag 的真实本地化名称；
- Work Editor 新增 Work Type 编辑；
- Desktop I18N 覆盖新增 Vocabulary Audit 文案；
- Boundary Validator 固化 mapping docs/resources/code 一致性要求，并校验 JSON / CSV 条数同步、目标 Work Type / Genre ID 必须真实存在。

## 安全边界

- Repair 必须先 Preview，再由用户显式点击应用；
- Shared Pack 继续只读；
- 用户手工 Tag 不在自动修复范围；
- Genre / Tag 删除由 Rust 检查 Private Work 引用；
- 不修改 V1-18 Hotfix 3 Unified Library / Native I/O 扫描链。

## 版本

`0.1.21`

## 下一阶段

V1-22 继续 Desktop Governance Parity：Evidence / Review / Commit Plan / Curation / History / Restore / Portable Pack。
