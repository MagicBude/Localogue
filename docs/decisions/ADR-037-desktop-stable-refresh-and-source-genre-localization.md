# ADR-037：Desktop Stable Refresh 与 Source Genre Localization

## 状态

Accepted · V1-22

## 背景

V1-21 实机反馈暴露两个 Presentation 问题：

1. Facet、分页或语言变化时，Desktop 会先把已有结果替换成很矮的 LoadingState，WebView 因页面高度瞬间缩短而把 `scrollTop` 夹回顶部；
2. 来源 NFO / 站点分类的多语名称并不完整地存在 Canonical Genre 中，且用户提供了 1271 条跨站 Genre 多语参考表，但其中同时包含真正题材、技术属性、活动和发行属性，不能整体视为 Canonical allowlist。

## 决策

### 1. 查询结果采用 stale-while-refresh

首次请求可以显示阻塞 Loading；后续依赖变化保留上一次成功结果和 DOM 高度，仅标记 `refreshing`，新结果返回后原地替换。

该规则适用于 Desktop Works、People、Catalog Browse 和详情页异步数据，不改变共享 `library-query` 的业务语义。

### 2. Source Genre Catalog 只做 Presentation / Reference

`resources/vocabularies/source-genre-catalog.json/.csv` 保存来源 ID、URL、ja / zh-CN / zh-TW / en、note 与 source。

它可以：

- 在 Canonical Genre 缺少当前语言名称时补全显示；
- 为 unmapped audit 提供翻译和来源参考；
- 作为后续人工扩展 `import-term-mappings` 的候选词典。

它不能：

- 自动把全部来源分类创建成 Canonical Genre；
- 绕过 V1-21 的 `import-classification-normalizer`；
- 把技术规格、活动、渠道或发行属性重新污染 Genre / Tag。

### 3. Work Detail 使用顶部媒体画廊 + 全宽高密度主信息表

作品图片不再作为固定左栏与右侧长信息表并排，因为当 Metadata 明显高于图片时会形成持续空白。主视觉改为顶部媒体画廊，当前只加载一张本地图片并通过左右箭头 / 轻量标签切换 poster、fanart、thumbnail、cover；后续视频预览图可以继续复用同一画廊。作品核心事实与分类关系在画廊下方的全宽主信息表集中展示，Work Type / Genre / Tag 不再拆到页面底部的大卡片。

## 后果

- 筛选、分页、切语言不会因 LoadingState 高度变化主动回到顶部；
- Source Genre Catalog 可以提升多语显示，但不会破坏 Canonical Vocabulary 边界；
- Work Detail 更接近资料站的高密度信息架构；
- V1-23 可在稳定的数据语义和 Presentation 基础上继续 Governance Parity。

### V1-22 Hotfix 2 补充：Presentation 尺寸策略

Desktop Work Gallery 不以 `poster / fanart` 的类型名称假定图片方向，最终以图片实际 `naturalWidth / naturalHeight` 决定 portrait / landscape / square Presentation。类型只用于图片读取前的首帧预判。

Desktop 主内容区不再使用固定 `1460px` 最大宽度。Desktop 是可伸缩工作台而不是固定文章版心；Works Table、Facet、Browse 与 Detail 应使用窗口可用空间。需要控制阅读长度的字段由组件自身的内容宽度规则负责。
