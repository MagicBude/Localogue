# Localogue AI / Agent 协作说明

本文件用于约束后续参与 Localogue 的 AI、Agent 和开发者。任何实现方案在修改代码或数据结构前，都应先阅读本文件及 `docs/README.md`。

## 一、当前阶段

当前阶段：**V0 设计与规范冻结**。

在没有明确进入 V1 开发前，不应擅自：

- 引入数据库 ORM；
- 引入 SQLite；
- 接入在线爬虫；
- 接入外部 API；
- 实现播放器；
- 建立复杂微服务；
- 用临时代码绕开既有数据模型。

## 二、必须遵守的架构不变量

1. **Canonical Library 是唯一最终真相源。**
2. **外部导入内容先形成 Evidence，再经过规范化、匹配与审核。**
3. **任何 Importer / Connector 都不得直接无条件覆盖 Canonical Library。**
4. **Work 与 MediaFile 必须分离。** 一个作品可以没有本地文件，也可以关联多个媒体文件。
5. **Person 是统一人物实体。** 演员、导演等由关系角色区分，UI 可以按“女优”“导演”展示。
6. **原始语言内容不可被翻译覆盖。** 日本作品默认以日文原文为主要元数据。
7. **本地化名称、罗马字、旧艺名、曾用名、别名必须区分语义。**
8. **Work Type、Genre、Tag 必须分开。**
9. **关键关系必须结构化。** 禁止为了省事把演员、类型、系列等关系存成逗号拼接字符串作为最终模型。
10. **V1 的 JSON 只是持久化实现，不是 Domain Model 本身。**
11. **页面和业务逻辑不得直接散落读取 JSON 文件。** 应通过 Repository / Query Service 抽象。
12. **默认文件策略必须非破坏性。** 未经用户明确选择，不移动、重命名、删除原始媒体。
13. **筛选、排序和反向导航是一级产品能力。** 不能只做“列表 + 搜索框”。
14. **所有核心功能应离线可运行。**

## 三、语言约定

- 项目文档正文：中文；
- UI 默认可设置日文、简体中文、英文；
- 元数据原文：日本作品默认 `ja`；
- 程序内部 ID、字段名、枚举 ID：英文小写、稳定、不可随翻译变化；
- Git Commit：推荐中文 Conventional Commit，例如：
  - `docs: 初始化 Localogue V0 设计规范`
  - `feat: 增加作品多维筛选`
  - `fix: 修复人物别名匹配`

## 四、修改数据模型前

必须检查：

- `docs/data-model/`
- `docs/vocabulary/`
- `docs/architecture/`
- `docs/decisions/`

如果新需求会改变核心原则，应新建 ADR，而不是直接修改实现后再补文档。

## 五、文档同步规则

功能变化至少同步以下一项：

- 产品行为变化 → `docs/product/` 或 `docs/ui/`
- 数据结构变化 → `docs/data-model/`
- 枚举 / 术语变化 → `docs/vocabulary/` 与 `resources/vocabularies/`
- 导入格式变化 → `docs/import/` 与 `schemas/`
- 架构选择变化 → `docs/decisions/`
- 阶段进度变化 → `PROJECT_STATUS.md` 与 `CHANGELOG.md`

## 六、不要过度工程化

Localogue 的目标不是为了展示技术复杂度。优先级始终是：

**数据可信 > 浏览体验 > 可维护性 > 自动化程度 > 技术炫技。**
