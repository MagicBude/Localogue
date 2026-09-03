# V1-22 Desktop Information Architecture & Metadata Localization 实现导读

## 1. 为什么筛选会把页面拉回顶部

旧实现每次 Query 或语言变化都会把结果区域替换成 LoadingState。结果区域从数千像素瞬间缩成几十像素，WebView 只能把当前滚动位置裁剪回新的最大滚动范围，表现为“跳回顶部”。

V1-22 使用 `useStableAsyncData`：首次请求显示 Loading，后续刷新保留旧 `value`，只暴露 `refreshing=true`。新结果返回后原地替换，页面高度不会在请求期间骤降。

## 2. 为什么主语言现在默认同时切 Metadata

V1-20 保留 UI Language 与 Metadata Language 独立是正确的，但主工具栏同时展示两个选择器会让普通用户误以为“切中文”应自动让 Facet 词条变中文。

V1-22 将第一个控制定义为“语言（界面 + 元数据）”，满足默认预期；第二个“元数据语言（高级）”仍可单独覆盖，保留 Web 的双语言能力。

## 3. Source Genre Catalog

用户提供的 `genre.csv` 共 1271 条，日文、简中和英文完整，还带有来源 URL / source / note。V1-22 将其转换为 JSON 镜像并纳入 Repository 外的 Presentation Service。

关键边界：Source Genre Catalog 不是 Canonical Genre allowlist。来源站的 genre 桶可能混入 Blu-ray、活动、发行渠道或其他属性，真正自动进入 Canonical 的词仍必须由 `import-term-mappings` 显式批准。

## 4. Genre 本地化顺序

`localizeGenre`：

1. 优先 Canonical Genre 当前 Metadata Language 名称；
2. 若缺失，则用已有名称匹配 Source Genre Catalog alias；
3. 命中后返回 Catalog 当前语言名称；
4. 否则回退 Canonical 原有名称 / stable id。

该服务同时用于 Desktop 与 Web 的 Genre Presentation。

## 5. Work Detail 信息架构

V1-22 将 Work Detail 改为：

- 左侧：主海报、本地媒体 / Asset 数量；
- 右侧：番号、标题、简介与紧凑字段表；
- 字段表：发行日期、时长、演员、导演、Maker、Label、Series、作品类型、题材、标签；
- 下方：折叠编辑器和本地 Asset 管理。

分类不再放到页面最底部，减少卡片面积和无效留白。

## 6. 验证重点

- 在长 Works 列表中滚到中部，切换 Genre / Maker / 年份，滚动位置应基本保持；
- 切 UI / Metadata Language，旧结果应保留直到新文案原地替换；
- Work Type、Person Activity Status 等受控枚举应随语言变化；
- Genre 若 Canonical 缺少翻译但 Source Genre Catalog 有翻译，应显示目标语言；
- Work Detail 首屏应直接看到作品类型、题材和标签；
- Source Genre Catalog 命中的 unmapped term 只能显示“词表参考”，不能自动创建 Genre。
