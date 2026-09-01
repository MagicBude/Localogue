# Localogue

> 本地优先、资料库优先的个人媒体收藏与元数据管理系统。

Localogue 的目标不是成为另一个“刮削器”，也不是优先成为播放器，而是建立一个**长期可信、可维护、可浏览、可筛选、可迁移的个人媒体资料库**。

项目同时重视两件事：

- **资料治理（Curation）**：把不同来源的数据规范化、匹配、审核并沉淀为可信资料；
- **资料探索（Exploration）**：按人物、导演、厂商、厂牌、系列、年份、时长、作品类型、Genre、Tag 等维度浏览收藏。

## 当前阶段

当前进入 **V1：File-backed Library** 的第一批实现。

本批代码已经完成：

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
- 完全虚构的演示数据和演示图片。

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
