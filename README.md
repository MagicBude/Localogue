# Localogue

> 本地优先的 AV 个人资料库与策展管理器：扫描并关联本地媒体，叠加可信公共元数据与私人修订，支持浏览、筛选、编辑、备份和委托播放。

Localogue Desktop 是正式产品入口。项目当前版本为 **0.1.25 Internal Alpha**，正在进入 **0.2 Desktop Beta Readiness**。当前重点是把已有的数据与治理基础收敛成普通用户打开就会用的完整流程，而不是继续增加内部框架。

## 当前能力

- 多资料库和多个内容目录，可单独同步目录并按一个或多个目录浏览；
- NFO → 本地图片 → 媒体的显式统一同步，带进度、取消和增量识别；
- 普通单文件、多段、同番号版本、NFO 冲突、跨目录关联和损坏输入的可解释处理；
- 作品、人物、组织、系列、分类、收藏和私人编辑；
- 海报墙、封面墙、瀑布流、列表和表格共享同一查询；
- Source Evidence、Curated Catalog、Personal Library 三层数据语义；
- 日文、简体中文、英文界面及独立元数据显示；
- Portable Pack、备份、冲突预览、审计与恢复；
- 使用系统关联程序委托播放，不修改原始视频。

当前仍需完成 Windows 干净环境发行验收、真实大目录验收和日常流程打磨。在线元数据 Adapter、macOS / Linux 发行、Docker、内嵌播放器均不能描述为已经支持。

## 产品方向

Localogue 要学习 JavBoss 的零配置、完整任务流、目录管理、明确反馈、零侵入和紧凑 UI。项目的差异点是可信公共 Catalog、私人修订、字段来源和可恢复治理，但这些内部能力不能以增加普通用户操作负担为代价。

元数据获取是完整单一 App 最终需要补上的环节。当前提议通过受控外部 Adapter 获取数据并写入 Evidence，避免网页解析规则进入 UI 或直接覆盖 Catalog。详见：

- [产品定位](docs/product/positioning.md)
- [产品范围](docs/product/scope.md)
- [0.2 路线图](docs/product/roadmap.md)
- [Desktop 全流程审核台账](docs/development/desktop-ux-audit.md)

## 数据结构

Localogue 使用三个用户可理解的数据层：

1. **Source Evidence**：来自网站、NFO、导入文件或未来 Connector 的来源记录；
2. **Curated Catalog**：审核后的公共作品、人物、组织、系列、分类和三语名称；
3. **Personal Library**：本地文件关联、私人修订、收藏、评分、展示偏好和审计历史。

运行时使用标准 SQLite 3：

- `catalog.db`：只读公共 Catalog；
- `local.db`：可写私人资料。

JSON / CSV 继续用于 Git 维护、交换、人工审核和恢复。Asset 二进制与原始视频留在文件系统；Localogue 默认不移动、重命名或删除用户视频。

## 开发运行

要求 Node.js 22+、pnpm 11.x。Desktop 还需要 Rust 与 Tauri 前置环境。

```bash
pnpm install
pnpm desktop:doctor
pnpm desktop:dev
```

Next.js Web 是历史功能宿主与开发验证入口，目前仍可运行：

```bash
pnpm dev
```

Web 不再默认作为新用户推荐入口。退役前必须先完成能力清单与迁移，见 [ADR-047](docs/decisions/ADR-047-desktop-primary-product-and-web-retirement.md)。

## 验证

提交前运行：

```bash
pnpm check
```

涉及 Rust / Tauri Native Boundary 时另外运行：

```bash
pnpm desktop:rust:check
pnpm desktop:rust:test
```

自动检查通过只证明代码级门槛，不代表 Windows 安装包、真实目录和破坏性流程已经由用户验收。

## 仓库结构

```text
apps/desktop/       Tauri + Vite + React Desktop 正式产品壳
src/domain/         与宿主无关的领域实体和规则
src/application/    查询、扫描、审核、提交与治理用例
src/infrastructure/ JSON / SQLite 等 Repository Adapter
src/app/            Next.js 历史 Web 入口
resources/          受控词表与来源映射
schemas/            交换格式与数据校验 Schema
scripts/            校验、迁移、Catalog 构建和治理工具
docs/               产品、架构、数据模型和开发教材
```

## 项目原则

- Canonical 数据不能被外部来源静默覆盖；
- Work 与 MediaFile 分离；
- 关键关系结构化，稳定 ID 不随翻译改变；
- Shared Catalog 只读，私人写入只进入当前 Personal Library；
- 页面通过 Repository / Query Service 使用数据，不直接读取文件；
- 核心功能离线可运行，默认文件操作非破坏性；
- 数据可信 > 浏览体验 > 可维护性 > 自动化程度 > 技术炫技。

完整文档从 [docs/README.md](docs/README.md) 开始。当前实现清单见 [MANIFEST.md](MANIFEST.md)，阶段状态见 [PROJECT_STATUS.md](PROJECT_STATUS.md)，历史变化见 [CHANGELOG.md](CHANGELOG.md)。
