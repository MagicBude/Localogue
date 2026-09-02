# 更新日志

## V1-07 · Provenance、Commit History 与 Snapshot Recovery

- 新增 Work 字段级 append-only Provenance，记录字段采用 Evidence 与 Snapshot Restore 的历史。
- 作品详情页新增 Provenance 区域，可查看当前字段来源、时间和对应 Commit。
- 新增 `/history` Canonical Commit History 与 `/history/[id]` 提交详情页。
- Commit Receipt 升级为 schemaVersion 2，保存完整 operations 与 snapshotId，同时兼容 V1-06 旧 Receipt。
- 每次正式 Commit 前创建最小 Canonical Snapshot，仅保存本次即将触碰的文件 before-image。
- Commit 中途失败时自动尝试恢复 Snapshot，降低 JSON 多文件半提交风险。
- 新增受控 Snapshot Restore；只允许恢复同一 Work 的最新有效 Commit。
- 恢复前检查本次 Commit 创建的新实体是否已被其他 Work 引用，存在引用时阻止恢复。
- 用户主动恢复保留 Commit / Provenance 历史，并新增 Restore Receipt 与 restored Provenance Event。
- 恢复后对应 Evidence 生命周期重新变为 pending，可以重新审核和再次 Commit。
- Evidence 生命周期与 Evidence 本体分离，新增 pending / committed / ignored。
- Evidence Inbox 默认只看待审核项，并支持待审核 / 已归档 / 已忽略 / 全部筛选。
- ignored Evidence 禁止生成 Commit Plan 或正式归档，可随时恢复为 pending。
- 新增 `pnpm validate:audit`，检查 Commit、Snapshot、Restore、Provenance、Lifecycle 与 Evidence 的引用完整性。
- `pnpm check` 增加 Audit 数据校验。
- 新增 Evidence Lifecycle、Provenance Event 中日英受控词表和 V1-07 Schema 示例。
- 新增 Provenance/History 架构、Snapshot Recovery、Evidence 生命周期、教材导读和 ADR-015 / ADR-016。

## V1-06 · Review Decision 与 Canonical Commit

- 新增字段级 `keep_library / use_evidence` 审核决策。
- 新增实体级 `use_match / bind_existing / create_new / skip` 决策。
- ambiguous / unresolved 实体不再提供默认动作，必须人工明确处理。
- 新增 Commit Plan，正式写入前可预览将创建和修改的实体。
- 新增 SHA-256 fingerprint；执行前服务器重新生成计划，拒绝过期 Plan。
- 新增 Canonical Commit API 与 Commit Executor。
- 新增 Person、Organization、Series、Genre、Tag 的 JSON Repository 写入能力。
- Canonical JSON 写入顺序固定为“新依赖实体 → Work → Commit Receipt”。
- 新增 `review-commits` 留痕，Evidence Inbox 可识别已归档记录。
- 默认 Demo Library 明确设为只读；只有配置 `LOCALOGUE_LIBRARY_PATH` 才允许正式归档。
- 新增 `pnpm library:init`，可把 Demo Canonical 数据安全复制到 Git 忽略的私人 Library 用于学习和测试。
- `validate:data` 会读取 `.env.local`，使 CLI 校验与 Next.js 使用同一个 Library。
- 新增 Commit Plan、乐观并发、JSON 写入安全和私人 Library 模式教材文档。
- 新增 ADR-014，规定任何 Canonical 写入必须先经过 Commit Plan 和明确确认。

## V1-05 · Evidence Inbox 与实体匹配审核

- 新增 `/review` Evidence Inbox，集中查看私人资料目录中保存的 Evidence。
- 新增 `/review/[id]` 审核详情页，展示 Raw、Normalized 与 Canonical 三层数据。
- 按规范化番号精确检测 Canonical Library 中是否已有同一 Work。
- 新增保守 Entity Resolution：Person、Maker、Label、Series、Genre、Tag、Work Type 均采用规范化精确匹配。
- Person 匹配覆盖正式名、本地化名、罗马字、旧艺名、曾用名、别名和其他名称。
- 新增 `matched / new / ambiguous / unresolved` 实体解析状态。
- 新增 `same / different / evidence_only / library_only` 字段比较状态。
- 已有 Work 可对照番号、标题、发行日期、时长、简介、人物关系和分类关系。
- 导入成功后可直接进入 Evidence 审核箱。
- 新增已有作品冲突演示文件 `sample-existing-work.json`。
- 新增 Review Analysis、Evidence Inbox、实体匹配教材文档和 ADR-013。
- V1-05 仍不直接修改 Canonical Library，为 V1-06 字段级审核决策保留安全边界。

## V1-04 · Evidence-first 导入基础

- 修复点击“应用筛选”后页面跳回顶部的问题，筛选提交继续使用 URL 但保留当前滚动位置。
- 新增 `/import` 导入工作台。
- 新增 JSON、NFO、CSV、XLSX 四种文件预览。
- 新增粘贴 JSON 直接生成导入预览。
- 建立 Importer Registry、统一 Normalizer 与基础 Validator。
- 预览同时展示 Raw Data、Normalized Data 与解析警告。
- 新增 Evidence Store，确认后写入私人 `data/library/evidence`，不修改正式作品和人物。
- 新增四种虚构导入示例与 V1-04 教材级中文文档。

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
