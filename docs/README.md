# Localogue 文档索引

本目录是 Localogue 的长期设计依据。文档不是附属品，而是项目的一部分。

## 产品

- [愿景](product/vision.md)
- [定位](product/positioning.md)
- [设计原则](product/principles.md)
- [范围](product/scope.md)
- [路线图](product/roadmap.md)

## 架构

- [总体架构](architecture/overview.md)
- [数据流](architecture/data-flow.md)
- [Repository 模式](architecture/repository-pattern.md)
- [Canonical Library](architecture/canonical-library.md)
- [Evidence 模型](architecture/evidence-model.md)
- [多语言架构](architecture/localization.md)
- [存储演进](architecture/storage-evolution.md)
- [查询引擎](architecture/query-engine.md)
- [Commit Plan 架构](architecture/commit-plan.md)
- [Provenance、Commit History 与恢复架构](architecture/provenance-history.md)
- [数据分层与 Local Override 优先级](architecture/data-layer-precedence.md)
- [Presentation Preference：共享事实与我的展示选择](architecture/presentation-preferences.md)

## 数据模型

- [总览](data-model/overview.md)
- [作品](data-model/work.md)
- [人物](data-model/person.md)
- [组织](data-model/organization.md)
- [系列](data-model/series.md)
- [分类](data-model/classification.md)
- [资源](data-model/asset.md)
- [媒体文件](data-model/media-file.md)
- [来源追踪](data-model/provenance.md)

## 受控词表

- [词表总览](vocabulary/README.md)
- [作品类型](vocabulary/work-types.md)
- [Genre](vocabulary/genres.md)
- [人物状态](vocabulary/person-statuses.md)
- [职业事件](vocabulary/career-events.md)
- [人物姓名类型](vocabulary/person-name-types.md)
- [资源类型](vocabulary/asset-types.md)
- [人物关系角色](vocabulary/person-roles.md)
- [语言代码](vocabulary/languages.md)
- [核心术语](vocabulary/domain-terms.md)
- [核心字段对照](vocabulary/field-dictionary.md)
- [内置标签](vocabulary/built-in-tags.md)
- [导入词条映射表](vocabulary/import-term-mappings.md)
- [来源类型](vocabulary/source-types.md)
- [日期精度](vocabulary/date-precision.md)
- [资料治理状态](vocabulary/curation-statuses.md)
- [Review 作品状态](vocabulary/review-work-statuses.md)
- [实体匹配状态](vocabulary/entity-resolution-statuses.md)
- [字段比较状态](vocabulary/field-comparison-statuses.md)
- [Review 字段决策](vocabulary/review-field-decisions.md)
- [实体审核动作](vocabulary/entity-review-actions.md)
- [Evidence 生命周期状态](vocabulary/evidence-lifecycle-statuses.md)
- [Provenance 事件类型](vocabulary/provenance-event-types.md)
- [资料完整度等级](vocabulary/completeness-levels.md)
- [重复候选置信级别](vocabulary/duplicate-confidence-levels.md)

## 资料治理

- [总览](curation/overview.md)
- [资料完整度](curation/completeness.md)
- [重复检测](curation/duplicate-detection.md)
- [实体匹配](curation/entity-resolution.md)
- [字段冲突](curation/conflict-resolution.md)
- [MediaFile 人工绑定治理](curation/mediafile-binding.md)
- [V1-06 字段与实体审核决策](curation/v1-06-review-decisions.md)
- [Evidence 生命周期](curation/evidence-lifecycle.md)
- [V1-08 治理队列](curation/v1-08-governance-queues.md)

## 导入

- [导入总览](import/overview.md)
- [Evidence](import/evidence.md)
- [Localogue JSON](import/localogue-json.md)
- [CSV](import/csv.md)
- [XLSX](import/xlsx.md)
- [NFO](import/nfo.md)
- [文件夹扫描](import/folder-scanning.md)
- [审核流程](import/review-workflow.md)
- [V1-04 已实现格式](import/v1-04-supported-formats.md)
- [Evidence 文件存储](import/evidence-storage.md)

## 浏览与检索

- [总览](discovery/overview.md)
- [多维筛选](discovery/faceted-search.md)
- [筛选字段](discovery/filters.md)
- [排序](discovery/sorting.md)
- [时间线](discovery/timeline.md)
- [搜索](discovery/search.md)

## UI

- [信息架构](ui/information-architecture.md)
- [首页](ui/dashboard.md)
- [作品库](ui/work-library.md)
- [作品详情](ui/work-detail.md)
- [人物库](ui/person-library.md)
- [人物详情](ui/person-profile.md)
- [导入审核](ui/import-review.md)
- [语言设置](ui/language.md)
- [主题](ui/themes.md)
- [设置](ui/settings.md)

## 导出

- [导出总览](export/overview.md)

## 分享与社区资料

- [Shared Pack 规范](sharing/shared-packs.md)
- [Community Data 共享原则](sharing/community-data-policy.md)
- [社区资料稳定实体 ID](sharing/stable-community-ids.md)
- [Portable Pack 便携传输格式](sharing/portable-packs.md)
- [Community Data 主项目对接](sharing/community-data-integration.md)

## 安全

- [本地部署与设置接口安全边界](security/local-deployment.md)

## 存储

- [JSON Library](storage/json-library.md)
- [CSV / XLSX](storage/csv-xlsx.md)
- [资源文件](storage/assets.md)
- [文件存储模式](storage/storage-modes.md)
- [SQLite 迁移](storage/sqlite-migration.md)
- [V1 JSON Commit 安全策略](storage/v1-json-commit-safety.md)
- [V1 JSON Snapshot 与恢复策略](storage/snapshot-recovery.md)

## Desktop

- [Tauri Desktop 开发前置环境](desktop/tauri-prerequisites.md)
- [Desktop Runtime 架构](architecture/desktop-runtime.md)
- [V1-13 Tauri Desktop Alpha 实现导读](development/v1-13-tauri-desktop-alpha-walkthrough.md)
- [V1-14 Desktop Runtime Integration 实现导读](development/v1-14-desktop-runtime-integration-walkthrough.md)
- [V1-15 Desktop Feature Parity I 实现导读](development/v1-15-desktop-feature-parity-i-walkthrough.md)
- [V1-16 独立 NFO 资料库导入实现导读](development/v1-16-independent-nfo-library-ingest-walkthrough.md)
- [V1-21 Vocabulary Governance 实现导读](development/v1-21-vocabulary-governance-walkthrough.md)
- [V1-17 Unified Library Source 与本地图片 Asset 实现导读](development/v1-17-unified-library-source-and-local-assets-walkthrough.md)
- [V1-18 Desktop Presentation Parity 与 Unified Library 同步实现导读](development/v1-18-desktop-presentation-parity-and-unified-sync-walkthrough.md)
- [V1-19 Desktop Discovery Parity 实现导读](development/v1-19-desktop-discovery-parity-walkthrough.md)
- [V1-20 Desktop UX & I18N Parity 实现导读](development/v1-20-desktop-ux-and-i18n-parity-walkthrough.md)
- [V1-22 Desktop Information Architecture & Metadata Localization 实现导读](development/v1-22-desktop-information-architecture-and-metadata-localization-walkthrough.md)

## 开发

- [开始开发](development/getting-started.md)
- [学习路线：从网页到数据库](development/learning-path.md)
- [V1-01 基础实现导读](development/v1-foundation-walkthrough.md)
- [教材：JSON Repository](development/json-repository-walkthrough.md)
- [代码规范](development/coding-guidelines.md)
- [测试原则](development/testing.md)
- [AI 协作](development/ai-collaboration.md)

## 架构决策记录

见 [decisions/README.md](decisions/README.md)。

## 参考项目

见 [research/reference-projects.md](research/reference-projects.md)。

- [Gfriends 共享头像仓库对 Localogue 的启发](research/gfriends-sharing-model.md)

## V1-02 新增实现文档

- [分类索引浏览](discovery/catalog-browsing.md)
- [V1-02 Faceted Search 实现讲解](development/v1-02-faceted-search-walkthrough.md)
- [V1-02 三种作品视图讲解](development/v1-02-view-modes-walkthrough.md)

## V1-03 新增实现文档

- [响应式筛选栏与滚动位置修复](development/v1-03-responsive-filter-and-scroll.md)
- [URL 分页实现讲解](development/v1-03-pagination-walkthrough.md)
- [人物库高级筛选讲解](development/v1-03-person-filtering-walkthrough.md)
- [V1-04 导入流水线实现导读](development/v1-04-import-pipeline-walkthrough.md)
- [V1-04 应用筛选滚动位置修复](development/v1-04-filter-submit-scroll.md)
- [已选筛选条件 Chips](discovery/active-filter-chips.md)
- [响应式筛选器设计](ui/responsive-filters.md)
- [Maker / Label / Series 详情页](ui/catalog-detail-pages.md)


## V1-05 新增实现文档

- [V1-05 Review Analysis 模型](curation/v1-05-review-analysis.md)
- [教材：Evidence Inbox 与 Server Component](development/v1-05-evidence-inbox-walkthrough.md)
- [教材：实体匹配是怎样工作的](development/v1-05-entity-resolution-walkthrough.md)
- [V1-05 Evidence Inbox 使用说明](import/v1-05-review-inbox.md)
- [ADR-013：保守的规范化精确实体匹配](decisions/ADR-013-conservative-exact-entity-resolution.md)


## V1-06 新增实现文档

- [V1-06 字段与实体审核决策](curation/v1-06-review-decisions.md)
- [Evidence 生命周期](curation/evidence-lifecycle.md)
- [V1-08 治理队列](curation/v1-08-governance-queues.md)
- [Commit Plan 架构](architecture/commit-plan.md)
- [Provenance、Commit History 与恢复架构](architecture/provenance-history.md)
- [数据分层与 Local Override 优先级](architecture/data-layer-precedence.md)
- [教材：从 Review 到 Commit Plan](development/v1-06-commit-plan-walkthrough.md)
- [教材：Demo 与私人可写 Library](development/v1-06-private-library-mode.md)
- [V1 JSON Commit 安全策略](storage/v1-json-commit-safety.md)
- [V1 JSON Snapshot 与恢复策略](storage/snapshot-recovery.md)
- [ADR-014：正式写入前必须经过 Commit Plan](decisions/ADR-014-explicit-commit-plan-before-canonical-write.md)


## V1-07 新增实现文档

- [Provenance、Commit History 与恢复架构](architecture/provenance-history.md)
- [数据分层与 Local Override 优先级](architecture/data-layer-precedence.md)
- [Evidence 生命周期](curation/evidence-lifecycle.md)
- [V1-08 治理队列](curation/v1-08-governance-queues.md)
- [教材：从写文件到可审计资料库](development/v1-07-provenance-history-walkthrough.md)
- [V1 JSON Snapshot 与恢复策略](storage/snapshot-recovery.md)
- [Evidence 生命周期状态词表](vocabulary/evidence-lifecycle-statuses.md)
- [Provenance 事件类型词表](vocabulary/provenance-event-types.md)
- [ADR-015：Evidence 生命周期与 Evidence 本体分离](decisions/ADR-015-evidence-lifecycle-separate-from-evidence.md)
- [ADR-016：最小 Snapshot 与最新提交优先恢复](decisions/ADR-016-minimal-snapshot-and-latest-first-restore.md)


## V1-08 新增实现文档

- [资料完整度规则](curation/completeness.md)
- [重复候选规则](curation/duplicate-detection.md)
- [V1-08 治理队列](curation/v1-08-governance-queues.md)
- [教材：从字段检查到治理队列](development/v1-08-curation-walkthrough.md)
- [教材：人物资料写入链路](development/v1-08-person-editor-walkthrough.md)
- [资料完整度等级词表](vocabulary/completeness-levels.md)
- [重复候选置信级别词表](vocabulary/duplicate-confidence-levels.md)
- [ADR-017：完整度是派生治理信号](decisions/ADR-017-completeness-is-derived-signal.md)
- [ADR-018：人物手工编辑必须保留 before/after Receipt](decisions/ADR-018-person-manual-edit-audit-receipt.md)


## V1-09 新增实现文档

- [数据分层与 Local Override 优先级](architecture/data-layer-precedence.md)
- [Presentation Preference：共享事实与我的展示选择](architecture/presentation-preferences.md)
- [Shared Pack 规范](sharing/shared-packs.md)
- [Community Data 共享原则](sharing/community-data-policy.md)
- [社区资料稳定实体 ID](sharing/stable-community-ids.md)
- [Portable Pack 便携传输格式](sharing/portable-packs.md)
- [Community Data 主项目对接](sharing/community-data-integration.md)
- [本地部署与设置接口安全边界](security/local-deployment.md)
- [教材：设置页与分层资料库](development/v1-09-settings-and-layered-library-walkthrough.md)
- [ADR-019：网页设置与环境变量优先级](decisions/ADR-019-web-settings-with-environment-override.md)
- [ADR-020：Shared Base + Local Override](decisions/ADR-020-shared-base-local-override.md)

## V1-10 · Asset / MediaFile / Presentation Preference

- [Asset 与 Presentation Preference 解析](architecture/asset-presentation-resolution.md)
- [MediaFile 私人数据层](architecture/mediafile-private-layer.md)
- [V1-10 图片上传与媒体扫描教材](development/v1-10-assets-and-media-walkthrough.md)
- [Private Asset 文件存储](storage/asset-files.md)
- [媒体文件页面](ui/media-library.md)
- [ADR-021 展示偏好不得强迫复制 Shared Entity](decisions/ADR-021-presentation-preference-does-not-copy-shared-entity.md)
- [ADR-022 MediaFile 永远属于 Private Layer](decisions/ADR-022-mediafile-is-private-only.md)


## V1-11 · Media Binding / Portable Packs

- [MediaFile 人工绑定治理](curation/mediafile-binding.md)
- [Portable Pack 便携传输格式](sharing/portable-packs.md)
- [Community Data 主项目对接](sharing/community-data-integration.md)
- [教材：Portable Pack 与 MediaFile 绑定](development/v1-11-packs-and-media-binding-walkthrough.md)
- [ADR-023：Portable Pack 是传输容器](decisions/ADR-023-portable-pack-is-transport-container.md)
- [ADR-024：MediaFile 人工绑定必须审计](decisions/ADR-024-mediafile-manual-binding-is-audited.md)

## V1-12 · Platform Abstraction / Incremental Media Scan

- [Platform Abstraction：从 Next.js Web 走向 Tauri Desktop](architecture/platform-abstraction.md)
- [增量媒体扫描架构](architecture/incremental-media-scan.md)
- [教材：从“能扫描”到“平台无关的增量扫描”](development/v1-12-platform-and-incremental-scan-walkthrough.md)
- [local-javlibrary 对 Localogue 的参考价值](research/local-javlibrary-reference.md)
- [ADR-025：先建立 Platform Ports，再引入 Tauri Shell](decisions/ADR-025-platform-ports-before-tauri-shell.md)
- [ADR-026：Snapshot Diff 是扫描基线，Filesystem Watcher 只是增强](decisions/ADR-026-snapshot-diff-before-filesystem-watcher.md)

- `development/v1-23-desktop-governance-parity-walkthrough.md`：Desktop Evidence / Review / Commit / Curation / History / Restore 实现导读。
