# V1-19 Desktop Discovery Parity 实现导读

V1-18 解决了“本地图片真正显示”和 Unified Library 同步。实机验收继续暴露出 Presentation/Discovery 差距：主页与 Person 相关作品仍走旧占位 Tile，Works 只有少量筛选，People 没有 Web 的高级筛选，也缺少分类浏览入口。

V1-19 的目标是关闭这组日常浏览差距。

## 1. DesktopWorkExplorer

`apps/desktop/src/desktop-work-explorer.tsx` 统一承载：

- WorkQuery 全部日常筛选字段；
- self-excluding Facet Count；
- 已选筛选 Chips；
- 分页；
- 海报墙 / 列表 / 表格；
- Private Asset 海报展示。

Works 页面、Person Detail 相关作品、Catalog Detail 都复用它。

## 2. 首页不再使用旧占位 WorkTile

首页最近作品读取 Assets 后调用 `buildDesktopWorkCards + DesktopWorkResults`，因此和 Works 海报墙使用同一套 poster resolver。

## 3. 人物库高级筛选

`desktop-person-explorer.tsx` 对齐 Web 的姓名/别名、状态、出生年份、出道年份、引退年份、身高区间和排序，并保持 Web 当前“人物库以 performer 关系收口”的语义。

## 4. Person Detail 相关作品

不再使用简单 WorkTile 网格，而是传入 `fixedPersonId` 复用 DesktopWorkExplorer。固定人物条件不会在 UI 中被用户误改，其余导演、Maker、Label、Series、Genre、Tag、年份、日期、时长等条件仍可继续组合。

## 5. 分类浏览

Desktop 新增“浏览”一级入口，提供 Maker、Label、Series、Genre、Director、Work Type、Tag 索引。进入分类后仍可继续组合 Work Facet。

## 6. 下一阶段

V1-19 完成的是 Discovery/Presentation parity，不等于 Web 全部治理功能已经迁移。Evidence / Review / Curation / History、Portable Pack 完整导入导出与 Presentation Preference 管理进入下一阶段。
