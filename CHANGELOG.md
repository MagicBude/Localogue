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
