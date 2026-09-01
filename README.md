# Localogue

> 本地优先、资料库优先的个人媒体收藏与元数据管理系统。

Localogue 的目标不是成为另一个“刮削器”，也不是优先成为播放器，而是建立一个**长期可信、可维护、可浏览、可筛选、可迁移的个人媒体资料库**。

它把 NFO、JSON、CSV、XLSX、本地文件、图片、人工录入以及未来可选的外部数据源统一视为输入，通过规范化、实体匹配、审核与来源追踪，形成自己的 **Canonical Library（规范资料库）**。

## 当前阶段

当前仓库版本为 **V0：设计与规范冻结版**。

V0 不实现正式业务代码，目标是先确定：

- 产品定位与边界；
- 核心架构原则；
- 作品、人物、组织、系列、分类、资源、媒体文件等数据模型；
- JSON-first 的 V1 持久化方案；
- CSV / XLSX 的导入导出与批量编辑定位；
- V2 迁移 SQLite 的兼容策略；
- 多维筛选、排序、时间线和全文搜索设计；
- 演员档案页的信息结构；
- 日文原文优先、中英映射的多语言策略；
- Evidence → Review → Canonical Library 的数据治理流程；
- 受控词表及中 / 日 / 英三语对照；
- 后续 AI 协作时必须遵守的项目约束。

## 核心定位

Localogue 同时重视两件事：

1. **资料治理（Curation）**：把来源不同、质量不同的数据整理成可信资料；
2. **资料探索（Exploration）**：让用户可以按演员、导演、系列、厂商、厂牌、时间、类型、标签、时长等维度自由筛选和浏览。

## 四个一级能力

- **浏览**：作品、演员、导演、系列、厂商、厂牌、类型、标签、时间线；
- **导入**：文件夹扫描、NFO、JSON、CSV、XLSX、图片、手工录入；
- **整理**：待审核、重复实体、缺失资料、冲突字段、未匹配关系、资料完整度；
- **设置**：界面语言、元数据语言优先级、主题、文件存储策略等。

## V1 / V2 路线

### V1：File-backed Library

- JSON 为规范资料库的持久化格式；
- CSV / XLSX 用于批量导入、导出和人工编辑；
- Web 端完成作品浏览、人物档案、多维筛选、排序、时间线、导入审核等核心体验；
- 不依赖网络、不依赖任何刮削站点；
- 不实现正式播放器；
- 不把 SQLite 作为前置条件。

### V2：SQLite Library

- 用 SQLite 替换 JSON Repository；
- Domain Model、页面、查询条件、受控词表和导入格式尽量保持不变；
- JSON / CSV / XLSX 继续作为交换格式存在；
- 引入更高效的关系查询、聚合统计、FTS 全文搜索和索引。

## 阅读顺序

第一次接触项目的人或 AI，建议依次阅读：

1. `README.md`
2. `AGENTS.md`
3. `PROJECT_STATUS.md`
4. `docs/README.md`
5. `docs/product/vision.md`
6. `docs/product/principles.md`
7. `docs/architecture/overview.md`
8. `docs/data-model/overview.md`
9. `docs/vocabulary/README.md`
10. `docs/decisions/` 下的 ADR

## 目录说明

```text
Localogue/
├── README.md
├── AGENTS.md
├── PROJECT_STATUS.md
├── CHANGELOG.md
├── docs/                 # 中文设计与开发文档
├── resources/            # 机器可读的受控词表
├── schemas/              # V1 数据格式约定
└── examples/             # 示例数据
```

## 项目原则摘要

- Canonical Library 是最终真相源；
- 外部输入是 Evidence，不直接覆盖正式资料；
- 原始日文元数据永久保留；
- Work 与 MediaFile 分离；
- Person 与作品关系结构化，不把演员名塞成逗号字符串；
- Work Type、Genre、Tag 是三个不同概念；
- 筛选与资料治理同等重要；
- V1 先 JSON，V2 再 SQLite；
- 持久化层必须通过 Repository 抽象，避免重写业务层；
- 默认不破坏用户已有文件；
- 核心功能应在完全离线环境中可用。

详细内容见 `docs/README.md`。
