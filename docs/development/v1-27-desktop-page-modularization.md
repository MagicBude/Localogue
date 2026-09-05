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

下一批单独拆分 Media 页面。Media 同时包含扫描 Job、NFO Preview、Asset Import、Vocabulary Repair 和人工绑定，拆分时应继续按 Application 能力划分子组件，不能把扫描规则复制进 React。
