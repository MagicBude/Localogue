# Localogue 项目状态

## 当前阶段

**V1-03：浏览体验、URL 状态与实体详情增强。**

V0 的设计规范仍然是项目架构基线；V1 使用 JSON 作为文件化 Canonical Library，SQLite 计划在 V2 引入。

## 已完成

- Domain Model 与 JSON Repository；
- 三语 UI / 元数据语言回退；
- Light / Dark / System 主题；
- 作品库、作品详情、人物库、人物详情；
- 组合筛选：演员、导演、Maker、Label、Series、Genre、Work Type、Tag、年份、日期范围、时长、封面、本地媒体；
- self-excluding Facet 动态计数；
- 海报墙、列表、表格三种作品视图；
- 修复筛选侧栏过窄和横向溢出；
- 视图切换保持当前滚动位置；
- 已选筛选条件 Chips 与单项移除；
- 作品与人物 URL 分页；
- 人物状态、出生年份、出道年份、引退年份、身高范围与排序；
- Maker / Label / Series 详情页；
- Maker ↔ Label 关系浏览；
- `/browse` 与 Maker / Label / Series / Genre / Director / Work Type / Tag 分类入口；
- 虚构 Demo Library 与真实私人资料目录隔离；
- JSON 数据引用校验脚本；
- V1-01 ~ V1-03 对应教材级中文实现文档。

## 下一阶段建议

V1-04 优先实现：

1. Genre / Director / Work Type / Tag 详情页；
2. 人物库已选条件 Chips 与更完整 Facet 计数；
3. 作品列表的“每页数量”设置；
4. 统一 URL Query Builder，减少组件内重复拼接；
5. 建立 Import / Review 的文件化数据结构；
6. 开始 Localogue JSON 的真实导入预览流程。

## 当前不做

- SQLite；
- 在线爬虫与 Provider；
- 外部 API Connector；
- AI Agent；
- 浏览器播放器；
- 自动搬移用户媒体文件。
