# Localogue

> 本地优先、资料库优先的个人媒体收藏与元数据管理系统。

Localogue 的目标不是成为另一个“刮削器”，也不是优先成为播放器，而是建立一个**长期可信、可维护、可浏览、可筛选、可迁移的个人媒体资料库**。

项目同时重视两件事：

- **资料治理（Curation）**：把不同来源的数据规范化、匹配、审核并沉淀为可信资料；
- **资料探索（Exploration）**：按人物、导演、厂商、厂牌、系列、年份、时长、作品类型、Genre、Tag 等维度浏览收藏。

## 当前阶段

当前处于 **V1-11：MediaFile 绑定治理与 Portable Pack 阶段**。

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
- Evidence 文件保存；
- Evidence Inbox；
- 按番号检测已有作品；
- 人物 / 组织 / 系列 / Genre / Work Type 精确实体匹配；
- Evidence 与 Canonical Work 字段差异对照；
- 字段级审核决策；
- 人物 / 组织 / Series / Genre / Tag 实体级审核决策；
- Commit Plan 预览；
- fingerprint 过期计划保护；
- 私人 JSON Canonical Library 正式写入；
- Commit Receipt 留痕；
- Work 字段级 Provenance；
- Commit History 与历史详情；
- Commit 前最小 Snapshot；
- 失败自动恢复与受控人工恢复；
- Evidence 生命周期 pending / committed / ignored；
- Audit 数据完整性校验；
- Work / Person 资料完整度评分与缺失项解释；
- `/curation` 日常资料治理工作台；
- Evidence pending / ignored 批量生命周期治理；
- 人物资料 Web 手工编辑与 before/after 审计 Receipt；
- Work / Person 可解释重复候选发现。
- `/settings` 实例设置中心；
- 网页配置 Private Library 路径；
- Shared Pack 只读共享资料挂载；
- `Private Library > Shared Packs` 本地优先读取；
- `.localogue/settings.json` 本机配置与环境变量覆盖。
- Private Asset 图片上传与 SHA-256 内容寻址；
- 人物头像 / 作品首图 Presentation Preference；
- Shared Pack Asset 与本地 Asset 统一显示；
- `/media` 本地视频文件管理；
- 设置页媒体扫描目录与 ffprobe 配置；
- ffprobe 实际时长、分辨率和编码分析；
- 可选视频完整 SHA-256；
- MediaFile 私人层与 Work 反向关联；
- MediaFile 人工绑定 / 改绑 / 解绑与审计 Receipt；
- `/packs` Shared / Personal Pack 管理；
- `.localogue-pack` 导出、预览与安全导入；
- 主项目 Community Validator 与 `localogue-community-data` V0-01 协议对接。

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
validate:data → validate:audit → lint → typecheck → build
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

真实个人资料使用 Git 忽略的 `data/library/` 或仓库外 `LOCALOGUE_LIBRARY_PATH`。

V1-09 起，普通本地用户可以直接打开：

```text
http://localhost:3000/settings
```

设置 Private Library 路径，例如：

```text
./data/library
D:\LocalogueLibrary
```

设置保存在 Git 忽略的 `.localogue/settings.json`，保存后后续请求即可使用新路径。

`.env.local` 中的 `LOCALOGUE_LIBRARY_PATH` 仍然支持，主要面向 Docker / NAS / 服务器部署，并且优先级高于网页设置。

初始化真实私人资料库建议执行：

```bash
pnpm library:init
```

它只创建空目录，不复制 Demo。若明确要做教学练习，再执行：

```bash
pnpm library:init:demo
```

V1-09 同时支持 Shared Pack：公共基础资料可以放在独立目录/仓库中只读挂载，而本地同 ID 实体始终拥有更高优先级。

真实社区资料建议与主程序仓库分离：主仓库只保存代码、Schema、词表、文档和虚构 Demo；可合法共享的事实型元数据放独立 Community Data / Shared Pack。图片、长篇简介等内容则必须额外确认再分发权限。

V1-10 已实现 **Presentation Preference**：公共资料可以提供默认头像/封面，用户上传并选择的本地图片拥有更高显示优先级，而且不会因为社区资料更新被覆盖。

本地媒体目录可在 `/settings` 配置，再通过 `/media` 扫描。MediaFile 只属于私人层，不进入 Community Pack。

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


## V1-05：Evidence Inbox 与实体匹配

V1-05 在 V1-04 的“保存 Evidence”之后加入正式 Review 入口：

```text
/import
  ↓
保存 Evidence
  ↓
/review
  ↓
Work 重复检测
  ↓
Entity Resolution
  ↓
字段差异对照
```

当前自动匹配坚持“规范化后的精确匹配”：

- Person 会检查正式名、本地化名、罗马字、旧艺名、曾用名、别名等全部 `Person.names`；
- Maker / Label 会先限定 Organization Kind，再进行名称匹配；
- Series / Genre / Tag / Work Type 可通过稳定 ID 或多语言名称匹配；
- 唯一命中为 `matched`，无命中为 `new`，多个命中为 `ambiguous`；
- 暂不使用编辑距离、拼音、AI 等模糊算法自动绑定实体。

已有作品会进行字段级比较：

```text
same
different
evidence_only
library_only
```

V1-06 在这个基础上加入了真正的安全写入闭环：

```text
Review Analysis
  ↓
Review Decisions
  ↓
Commit Plan
  ↓
Explicit Confirm
  ↓
Fingerprint Recheck
  ↓
Canonical JSON + Commit Receipt
```

默认 Demo 模式仍然禁止写入，只有通过 `/settings` 或 `LOCALOGUE_LIBRARY_PATH` 显式配置私人 Library 后才启用正式归档。

建议学习：

1. `docs/development/v1-05-evidence-inbox-walkthrough.md`
2. `docs/development/v1-05-entity-resolution-walkthrough.md`
3. `src/domain/entities/review.ts`
4. `src/application/review/entity-resolution-service.ts`
5. `src/app/review/page.tsx`
6. `src/app/review/[id]/page.tsx`


## V1-06：Review Decision 与 Commit Plan

V1-06 第一次允许审核后的 Evidence 正式进入 Canonical Library，但没有加入“一键覆盖”。

字段冲突可以明确选择“保留资料库”或“采用 Evidence”；实体关系可以选择使用精确匹配、绑定歧义候选、创建新实体或跳过。

生成 Commit Plan 后，页面会列出准备创建/修改的实体以及 blockers / warnings。最终确认时服务器重新生成计划并比较 SHA-256 fingerprint，避免旧页面依据过期资料执行写入。

推荐学习：

1. `docs/curation/v1-06-review-decisions.md`
2. `docs/architecture/commit-plan.md`
3. `docs/development/v1-06-commit-plan-walkthrough.md`
4. `src/application/review/commit-plan-service.ts`
5. `src/application/review/commit-executor.ts`
6. `src/components/review-commit-workbench.tsx`


## V1-07：Provenance、历史与可恢复性

V1-07 开始回答“资料为什么是现在这样”和“如果审核错了怎么办”。

新的正式写入链路：

```text
Evidence
  ↓
Review Decisions
  ↓
Commit Plan + fingerprint
  ↓
Canonical Snapshot
  ↓
Canonical Write
  ↓
Field Provenance
  ↓
Evidence Lifecycle = committed
  ↓
Commit Receipt
```

新增入口：

```text
/history
/history/[commitId]
```

在作品详情页还可以直接看到当前字段的 Provenance，例如某个时长、标题或演员关系最近由哪条 Evidence 采用。

如果需要撤销成功 Commit，不能任意覆盖旧版本。Localogue 会：

1. 确认目标是该 Work 最新的有效 Commit；
2. 检查本次创建的新实体有没有被其它 Work 使用；
3. 恢复提交前 Snapshot；
4. 保留原 Commit 历史；
5. 写入 Restore Receipt；
6. 追加 `restored` Provenance Event；
7. 把对应 Evidence 恢复为 `pending`。

审计数据可以单独检查：

```bash
pnpm validate:audit
```

推荐学习：

1. `docs/development/v1-07-provenance-history-walkthrough.md`；
2. `src/application/review/commit-executor.ts`；
3. `src/infrastructure/history/canonical-snapshot-store.ts`；
4. `src/application/history/restore-service.ts`；
5. `src/infrastructure/provenance/work-provenance-store.ts`。


## V1-08：资料治理工作台

V1-08 增加 `/curation`，把“知道资料哪里不完整”变成可以直接处理的队列。

主要入口：

```text
/curation
/curation/evidence
/curation/duplicates
/people/[id]/edit
```

完整度是运行时派生数据，不写入 Canonical JSON；重复检测只产生候选，不自动合并。人物编辑只有显式配置私人 Library（网页设置或 `LOCALOGUE_LIBRARY_PATH`）后才允许保存，每次修改生成 `person-edits/` before/after 审计记录。

建议学习：

1. `docs/development/v1-08-curation-walkthrough.md`
2. `src/application/curation/completeness-service.ts`
3. `src/application/curation/duplicate-detection-service.ts`
4. `docs/development/v1-08-person-editor-walkthrough.md`
5. `src/application/people/person-edit-service.ts`


## V1-11：MediaFile 绑定治理与 Portable Pack

V1-11 增加两个日常入口：

```text
/media/[mediaFileId]
/packs
```

未识别 MediaFile 可以先查看可解释候选，再按番号/标题搜索并明确绑定；绑定、改绑、解绑都会写入 `media-binding-receipts/`。

`/packs` 支持：

- 导出 Personal Pack，用于换电脑迁移私人资料与 Asset；
- 导入 Personal Pack，默认只补缺失文件，不覆盖已有本地资料；
- 对已挂载 Community Shared Pack 执行严格 Validator；
- 将通过校验的 Shared Pack 导出成单文件 `.localogue-pack`；
- 在另一实例安装 Shared Portable Pack，并自动挂载到 `sharedPackPaths`。

Personal Pack 故意不包含 `media-files/` 和 `.localogue/settings.json`：磁盘路径与实例配置通常不能跨设备直接复用。

推荐学习：

1. `docs/development/v1-11-packs-and-media-binding-walkthrough.md`
2. `src/application/packs/portable-pack-service.ts`
3. `src/infrastructure/packs/portable-pack-codec.ts`
4. `src/infrastructure/packs/community-pack-validator.ts`
5. `src/application/media/media-binding-service.ts`
