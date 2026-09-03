# ADR-038：Curated Genre Aliases 与 Work Detail Hero Asset Policy

## 状态

Accepted — V1-22 Hotfix 3

## 背景

V1-22 曾把用户提供的 1271 条跨站 `genre.csv` 完整镜像进仓库，虽然只作为 reference layer，但该表本身混合了内容题材、技术规格、活动、载体与发行属性。长期保留会增加误用风险，也让 Runtime 依赖一份并非 Localogue 受控词表的数据。

同时，Work Detail 顶部媒体画廊曾同时展示 poster / fanart / screenshot。纵向 poster 与横向 Hero Surface 的目标冲突，即便通过动态高度适配也会让页面过高或视觉比例失衡。

## 决策

### 1. 不保存完整外部 Genre 参考表

仓库只保留：

- `genres.{csv,json}`：33 个明确 Canonical Genre；
- `genre-source-aliases.{csv,json}`：67 条人工批准来源别名；
- `import-term-mappings.{csv,json}`：来源分类到 Domain 维度的显式路由。

完整外部 `genre.csv` 仅作为一次性人工参考输入，不成为 Runtime Resource。

### 2. 技术 / 发行 / 活动属性不进入 Genre

`デビュー作`、`周年`、`ハイビジョン`、`有码`、`Blu-ray` 等保持 source-only 或等待未来专门 Domain 字段。

### 3. Poster 不进入 Work Detail Hero Gallery

Poster 继续用于：

- Works 海报墙；
- Works 列表缩略图；
- 首页最近作品；
- Person 相关作品；
- Asset 管理。

Work Detail 顶部 Hero Gallery 只面向更适合宽屏浏览的 fanart / screenshot / gallery / cover 等视觉资产。若没有 Hero-compatible Asset，则直接显示高密度 Metadata，不为 poster 强制创建大画廊。

## 结果

- Genre Facet 的语义边界更清晰；
- 外部参考数据不会变成隐式运行时真相；
- Work Detail 不再为了纵向 poster 拉出超高 Hero；
- 后续视频预览图、截图、fanart 可以自然扩展顶部 Gallery。
