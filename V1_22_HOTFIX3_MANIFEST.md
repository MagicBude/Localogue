# V1-22 Hotfix 3 Manifest

## 目标

修正两个 V1-22 实机反馈：

1. 纵向 poster 与宽屏 Work Detail Hero Gallery 的视觉目标冲突；
2. 用户提供的完整 `genre.csv` 只是参考资料，不应原样作为 Runtime Source Genre Catalog 长期保留。

## Work Detail Hero Policy

- poster 不再进入详情顶部 Hero Gallery；
- poster 继续用于 Works 海报墙、列表、首页最近作品、Person 相关作品和 Asset 管理；
- Hero Gallery 面向 fanart / screenshot / gallery / cover 等更适合宽屏浏览的图片；
- 没有 Hero-compatible Asset 时直接显示 Metadata，不创建只为 poster 服务的超高画廊；
- 保留左右切换、当前序号、真实宽高比和后续视频预览扩展入口。

## Vocabulary Consolidation

- 删除完整 `source-genre-catalog.{csv,json}` Runtime 依赖；
- 不保留 1271 条外部参考数据的仓库副本；
- 从参考表人工筛选 67 条明确来源别名；
- 新增 `genre-source-aliases.{csv,json}`；
- Canonical Genre 校正并扩充为 33 条；
- `デビュー作 / 周年 / ハイビジョン` 不再是 Genre；
- `有码 / Blu-ray / 技术规格 / 活动 / 发行属性` 不进入 Genre；
- Importer 统一读取 Canonical Genre + Approved Source Aliases；
- Vocabulary Repair 可清除历史误建的 deprecated Genre 引用。

## 需要手工删除的旧文件

ZIP 覆盖不能删除仓库已有文件。覆盖后请手工删除：

```text
resources/vocabularies/source-genre-catalog.csv
resources/vocabularies/source-genre-catalog.json
docs/vocabulary/source-genre-catalog.md
```

完整清单也写入根目录 `V1_22_HOTFIX3_DELETE_FILES.txt`。

## 版本

产品版本继续保持 `0.1.22`。
