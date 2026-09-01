# Localogue

> 本地优先、资料库优先的个人媒体收藏与元数据管理系统。

Localogue 的目标不是成为另一个“刮削器”，也不是优先成为播放器，而是建立一个**长期可信、可维护、可浏览、可筛选、可迁移的个人媒体资料库**。

项目同时重视两件事：

- **资料治理（Curation）**：把不同来源的数据规范化、匹配、审核并沉淀为可信资料；
- **资料探索（Exploration）**：按人物、导演、厂商、厂牌、系列、年份、时长、作品类型、Genre、Tag 等维度浏览收藏。

## 当前阶段

当前处于 **V1-04：Evidence-first 文件导入基础阶段**。

当前 V1 已完成：

- Next.js Web 基础工程；
- TypeScript 严格模式；
- Work / Person / Organization / Series / Asset 等 Domain Model；
- `LibraryRepository` 抽象；
- `JsonLibraryRepository`；
- 文件化 Canonical Library；
- 受控词表读取；
- 日 / 中 / 英元数据回退；
- UI 语言与元数据语言独立设置；
- 浅色 / 深色 / 跟随系统主题；
- 首页资料库概览；
- 作品库和作品详情；
- 演员库和演员详情；
- 番号 / 标题搜索；
- 演员、导演、Maker、Label、Series、Genre、Work Type、Tag、年份、日期范围、时长筛选的 Query Engine 基础；
- 发行日期、时长、番号、标题、加入时间、更新时间排序基础；
- 人物详情页复用统一 WorkQuery 进行二次筛选；
- 完全虚构的演示数据和演示图片；
- JSON / NFO / CSV / XLSX 导入预览；
- Evidence 文件保存。

## 技术栈

- Next.js 16.3.3
- React 19.2.8
- TypeScript 5.9
- ESLint 9
- pnpm 11.x
- V1 持久化：JSON
- V2 计划：SQLite

V1 暂时没有 Tailwind、ORM、数据库、状态管理库和 UI 组件库。这样更适合先理解浏览器、React、Next.js、CSS、数据模型和 Repository 的基本关系。

## 运行项目

建议 Node.js 22 或更高版本。

```bash
pnpm install
pnpm dev
```

浏览器打开：

```text
http://localhost:3000
```

开发前建议执行完整检查：

```bash
pnpm check
```

它依次执行：

```text
validate:data → lint → typecheck → build
```

## 推荐学习顺序

如果你希望一边开发 Localogue 一边学习网页和数据库相关知识，建议按这个顺序看代码：

1. `docs/development/learning-path.md`
2. `src/domain/entities/`
3. `data/demo-library/`
4. `src/domain/repositories/library-repository.ts`
5. `src/infrastructure/repositories/json-file-store.ts`
6. `src/infrastructure/repositories/json-library-repository.ts`
7. `src/application/services/`
8. `src/app/layout.tsx`
9. `src/app/page.tsx`
10. `src/app/works/page.tsx`
11. `src/app/people/[id]/page.tsx`
12. `src/app/globals.css`

## 为什么 V1 先用 JSON

JSON 是 V1 的持久化实现，而不是 Domain Model 本身。

页面不能这样做：

```text
React Page → fs.readFile("works/xxx.json")
```

Localogue 使用：

```text
Page
  ↓
Application Service
  ↓
LibraryRepository
  ↓
JsonLibraryRepository（V1）
  ↓
JSON files
```

V2 会变成：

```text
Page
  ↓
Application Service
  ↓
LibraryRepository
  ↓
SqliteLibraryRepository（V2）
  ↓
SQLite
```

因此迁移数据库的目标不是“重写网站”，而是替换持久化实现。

## 数据目录

V1 示例 Canonical Library：

```text
data/demo-library/
├── works/
├── people/
├── organizations/
├── series/
├── genres/
├── tags/
├── assets/
├── evidence/
└── indexes/
```

仓库中的 `DEMO-*` 作品、人物、厂商和图片全部是虚构示例，仅用于开发和学习。

真实个人资料后续会提供更明确的“用户资料目录”和导入流程，不应直接混入 Git 仓库中的 Demo 数据。

## 项目原则摘要

- Canonical Library 是最终真相源；
- 外部输入先成为 Evidence；
- 原始日文元数据永久保留；
- UI 语言和元数据显示语言分离；
- Work 与 MediaFile 分离；
- Person 是统一人物实体；
- Work Type、Genre、Tag 分离；
- 关键关系必须结构化；
- 筛选、排序、时间线和反向导航是一等能力；
- V1 JSON，V2 SQLite；
- 默认文件操作非破坏性；
- 核心功能离线可运行。

## 文档

完整设计见 [`docs/README.md`](docs/README.md)。

后续 AI 或开发者开始修改项目前，必须先阅读：

1. `AGENTS.md`
2. `PROJECT_STATUS.md`
3. `docs/README.md`
4. `docs/product/principles.md`
5. `docs/decisions/`


## V1-02：分类浏览与三种作品视图

在 V1-01 基础上，V1-02 增加了真正面向“资料探索”的浏览能力：

- `/browse`：分类浏览总入口；
- `/makers`、`/labels`、`/series`、`/genres`、`/directors`、`/work-types`、`/tags`；
- `/works`：海报墙 / 列表 / 表格三种视图；
- Facet 使用 self-excluding 计数，让组合筛选时的数量提示更符合真实浏览习惯；
- 筛选、排序、视图全部保存在 URL，可刷新、复制和使用浏览器前进/后退。

建议学习顺序：

1. `docs/development/v1-02-view-modes-walkthrough.md`；
2. `src/components/work-view-switcher.tsx`；
3. `src/components/work-results.tsx`；
4. `docs/development/v1-02-faceted-search-walkthrough.md`；
5. `src/infrastructure/repositories/json-library-repository.ts` 中的 `buildWorkFacets()`。

## V1-03：浏览体验、分页与实体详情

V1-03 在 V1-02 的多维筛选基础上继续强化“资料探索”体验：

- 作品筛选侧栏加宽，并修复日期控件、Select、长文本导致的横向滚动；
- 小屏幕下筛选字段自动切换为更适合阅读的单列布局；
- 海报墙 / 列表 / 表格切换保持当前滚动位置；
- 当前筛选条件以 Chips 形式展示，可以逐项移除；
- 作品列表和人物列表加入 URL 分页；
- 人物库增加状态、出生年份、出道年份、引退年份、身高范围与多种排序；
- 人物搜索会覆盖正式名、中文映射、罗马字、别名、旧艺名和其他名称；
- Maker / Label / Series 拥有独立详情页，可以查看三语名称、关系与相关作品。

建议继续阅读：

1. `docs/development/v1-03-responsive-filter-and-scroll.md`；
2. `docs/development/v1-03-pagination-walkthrough.md`；
3. `docs/development/v1-03-person-filtering-walkthrough.md`；
4. `src/components/work-filter-chips.tsx`；
5. `src/components/pagination.tsx`；
6. `src/app/makers/[id]/page.tsx`。

## V1-04：Evidence-first 文件导入

V1-04 第一次让 Localogue 可以接收自己的资料，而不再只是浏览 Demo Library。

新增 `/import`，支持：

- JSON 文件；
- 直接粘贴 JSON；
- NFO；
- CSV；
- XLSX。

处理链路：

```text
外部文件
  ↓
Importer
  ↓
Normalizer
  ↓
Validator
  ↓
Preview
  ↓
Evidence Store
```

这一阶段仍然**不会直接写入正式 `works/` 或 `people/`**。真实导入默认保存到 Git 忽略的：

```text
data/library/evidence/
```

也可以通过：

```bash
LOCALOGUE_LIBRARY_PATH=D:/YourLibrary
```

将资料目录放到仓库之外。

V1-04 还修复了“应用筛选”提交后跳回页面顶部的问题：筛选仍然保存到 URL，但使用 Next.js 客户端导航保留滚动位置。

建议学习：

1. `docs/development/v1-04-filter-submit-scroll.md`
2. `src/components/url-query-form.tsx`
3. `docs/development/v1-04-import-pipeline-walkthrough.md`
4. `src/domain/entities/evidence.ts`
5. `src/infrastructure/importers/`
6. `src/application/importers/`
7. `src/app/api/import/preview/route.ts`
8. `src/components/import-workbench.tsx`
