# 更新日志

## V1-03 · 浏览体验与实体详情增强

- 修复作品筛选栏过窄、日期控件和长文本导致横向滚动的问题。
- 海报墙 / 列表 / 表格切换使用 `scroll={false}` 保持当前浏览位置。
- 新增已选筛选条件 Chips，可单项移除或全部清除。
- 新增作品 URL 分页，并在翻页后定位到结果区域。
- 新增人物库高级筛选：姓名/别名、状态、出生年份、出道年份、引退年份、身高范围。
- 新增人物姓名、出生时间、出道时间、身高排序。
- 新增 Maker、Label、Series 详情页与三语名称展示。
- 新增 Maker ↔ Label 关系导航和相关作品预览。
- 补充 V1-03 响应式布局、滚动、分页、人物查询与实体详情教材文档。

## V1-02 · 浏览与多维筛选增强

- 新增 `/browse` 分类浏览总入口。
- 新增 Maker、Label、Series、Genre、导演、Work Type、Tag 独立浏览页。
- 作品库支持海报墙、列表、表格三种视图。
- 人物详情页中的作品列表同步支持三种视图。
- 视图状态进入 URL，并在继续筛选时保持。
- Facet 计数升级为 self-excluding facets，支持更合理的动态计数。
- 新增分类浏览、Facet 算法和多视图实现的教材级中文文档。
- 保持 JSON Repository 与 Domain Query 的边界，为 V2 SQLite 查询实现保留一致语义。

# 变更记录

## V1-01 — 2026-09-01

### 新增

- 初始化 Next.js 16.3.3 Web 工程；
- 建立 Domain / Application / Infrastructure / UI 分层；
- 建立 `LibraryRepository` 和 `JsonLibraryRepository`；
- 加入 Work、Person、Organization、Series、Asset、MediaFile、Genre、Tag 类型；
- 加入文件化 JSON Canonical Library；
- 加入虚构作品、人物、组织、系列与图片 Demo 数据；
- 实现首页资料统计；
- 实现作品库、作品详情；
- 实现演员库、演员详情；
- 实现人物姓名历史和职业事件时间线展示；
- 实现 UI / Metadata 两套语言偏好；
- 实现日 / 中 / 英元数据回退；
- 实现浅色、深色、跟随系统主题；
- 实现 WorkQuery 的搜索、关系筛选、年份、时长和排序基础；
- 实现基础 Facet Count；
- 补充 V1 学习文档和 Repository 教材。

## V0 — 2026-09-01

### 新增

- 冻结 Localogue 的产品定位和核心边界；
- 确立“资料治理 + 资料探索”双核心；
- 确立 Canonical Library / Evidence / Review 模型；
- 确立 V1 JSON-first、V2 SQLite 的演进路线；
- 建立作品、人物、组织、系列、分类、资源、媒体文件等数据模型；
- 建立作品类型、Genre、人物状态、职业事件、姓名类型、资源类型等受控词表；
- 定义日文原文优先的多语言策略；
- 定义多维筛选、排序、时间线和人物页二次筛选；
- 定义 JSON / CSV / XLSX / NFO 的角色；
- 记录对 MDC-NG、MDCx、mdcx_sqlite、CM Collectors、Amane、mdcx-diy 的参考分析。
