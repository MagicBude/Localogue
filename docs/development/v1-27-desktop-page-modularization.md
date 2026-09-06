# Desktop 页面模块化整理

## 为什么拆分

Desktop 早期为了快速建立完整产品壳，把首页、作品、人物、媒体、资料包和设置页面集中在 `apps/desktop/src/App.tsx`。功能成熟后，这个入口同时承担导航、运行时初始化、页面数据读取和页面内部交互，修改一个详情页也需要进入两千行以上的文件。

模块化不是单纯把 JSX 搬到更多文件。当前拆分遵循以下边界：

- `App.tsx`：应用初始化、Library Profile、顶层导航和页面选择；
- `desktop-home-page.tsx`：首页摘要、最近作品与相关人物；
- `desktop-work-pages.tsx`：作品库入口和作品详情；
- `desktop-person-pages.tsx`：人物库入口和人物详情；
- `desktop-work-asset-gallery.tsx`：作品图片浏览 Presentation；
- Repository、Query 与 Native Boundary 继续位于原有 Application / Platform 层，页面模块不直接读取 JSON 或任意磁盘路径。

## 本轮交互调整

首页不再固定只展示 6 条最近作品。当前最多展示 12 条，以覆盖常见宽屏下更多网格行，并在标题区域提供“查看全部作品”入口。点击后进入统一 Works Explorer，筛选、分页和视图切换仍只维护一套。

首页原先先读取 6 条 Works，再次读取全部 Works 计算人物作品数。现在只读取一次按发行日期排序的 Works，同一结果同时用于：

- 首页作品总数；
- 最近 12 条作品；
- 相关人物；
- 人物作品数量。

这能减少一次 JSON Repository 全量扫描，也避免两个查询快照不一致。

## 后续拆分顺序

第二批已经拆出 Packs 与 Settings：前者只组合 Shared Pack 配置和 Portable Pack 工作台，后者集中管理 Library Profile、资料源路径与 Runtime 信息。

第三批已将 Media 工作台迁入独立模块，并删除 `App.tsx` 中只为 Media 服务的 Adapter、Importer 与展示 helper。页面继续复用 `MediaScanCoordinator` 和各 Application Service；资料刷新使用 stale-while-refresh，避免列表闪烁和滚动位置跳动。

Media 内部继续把扫描状态、NFO / 图片预览、词表审计、单文件诊断和媒体列表提取到 `desktop-media-sections.tsx`。这些 Section 只接收数据与回调，不创建 Coordinator、不写 Repository；页面控制器继续统一持有任务状态和执行顺序。

Desktop 外壳使用相同原则：`desktop-app-shell.tsx` 只渲染侧栏和顶栏，并通过回调上报导航、刷新、折叠和 Profile 切换意图；`App.tsx` 继续负责持久化与 Native Bridge。这样展示组件不会因为复用而获得不必要的平台权限。

页面文件拆开后，`App.tsx` 使用 `React.lazy` 按导航目标加载页面模块。源代码模块化和运行时分包是两件事：前者改善维护，后者才会缩小首次加载的入口包。`Suspense` fallback 保持内容区稳定，避免加载页面代码时 WebView 高度突然收缩。

分类浏览把 `CatalogKind`、选择到 `WorkQuery` 的映射、搜索规则和 Genre 分组规则收口到 `desktop-catalog-model.ts`。这个文件不依赖 React，适合先学习稳定业务规则；页面文件只负责读取 Repository、维护交互状态和渲染。

History Restore 迁到 `desktop-history-page.tsx`，并保持 Snapshot 恢复、Restore Receipt、Provenance 追加三个步骤在同一个用例中。拆文件以业务用例为边界，不能把事务顺序拆成互不协调的按钮组件。

Review 的字段决策、实体解析和 Commit Plan 预览迁到 `desktop-review-sections.tsx`。这些组件只把用户选择转换为新的 `ReviewDecisions` 并通过回调上报，不生成 Plan、不执行 Commit；真正的治理操作仍由 Review 控制器协调。

治理工作台先把 Curation 迁到 `desktop-curation-page.tsx`。完整度和重复候选是可重算的派生信号，Curation 页面只读取并展示它们；Review Commit 与 History Restore 仍留在 Governance 控制器，避免一次重构同时移动两条写入链。

多个页面反复出现的页面标题、信息卡和治理空状态收口到 `desktop-page-primitives.tsx`。这类组件只统一 HTML 语义与样式契约，不接收 Repository、Native Bridge 或业务回调。判断是否值得抽取的标准不是“代码长得像”，而是它们是否表达相同、稳定的界面概念；页面专属的表格、按钮组和流程状态仍留在所属模块。

Review 控制器迁到 `desktop-review-page.tsx`，`desktop-governance.tsx` 只保留 Private Library 前置检查和治理子页面路由。Review 中的状态按处理阶段排列为 Evidence 选择、重新分析、人工决策与 Plan 预览；Commit 仍严格执行“重新计算 fingerprint → 创建 before-image Snapshot → 按引用安全顺序写 Canonical → 追加 Provenance → 保存 Lifecycle 与 Receipt”，任一步失败都从 Snapshot 尝试补偿恢复。

Media Binding 从混合的管理表单文件迁到 `desktop-media-binding-panel.tsx`。候选搜索只提供人工判断依据，文件名番号也只用于初始化查询；只有用户明确点击绑定后才写入 `matchMethod=manual`。MediaFile 与 Binding Receipt 是两个 JSON 写入，Receipt 失败时必须把 MediaFile 恢复为操作前对象，避免留下没有审计记录的人工关系。
