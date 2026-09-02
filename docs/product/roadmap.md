# 路线图

## V0：设计与规范

目标：把产品边界、数据模型、词表、查询、导入和 UI 设计沉淀为文档。

## V1：File-backed Library

目标：先看到完整产品效果。

- Next.js Web；
- JSON Repository；
- JSON 示例资料；
- 作品浏览；
- 人物档案；
- Faceted Search；
- 时长筛选；
- 时间线；
- 三语；
- 主题；
- JSON / CSV / XLSX / NFO 导入导出；
- Review 原型。

## V1.x：资料治理增强

已进入此阶段。V1-09 已完成实例设置中心、Shared Pack 挂载与 Local Override 数据分层基础。

后续重点：

- ~~资料完整度与治理队列~~（V1-08）；
- ~~Evidence 生命周期批量治理~~（V1-08）；
- ~~人物资料手工维护~~（V1-08）；
- ~~重复作品 / 人物候选基础~~（V1-08）；
- ~~网页设置中心、Library 路径与 Shared Pack 数据分层~~（V1-09）；
- Asset 上传、封面选择、Presentation Preference 与 SHA-256 去重；
- MediaFile 扫描、ffprobe 与哈希；
- Work ↔ MediaFile 绑定审核；
- 更安全的实体 Merge Plan；
- CSV / XLSX 更完整的批量编辑回写。

## V2：SQLite

- SQLite Repository；
- JSON → SQLite 迁移器；
- 索引；
- 聚合 Facet；
- FTS5；
- 更大规模资料库性能优化。

## V3：Connectors

- JavInfo、DMM 或其他用户选择的数据源；
- Connector 只能生成 Evidence；
- 不直接修改 Canonical Library。

## V4：AI

- 自然语言检索；
- 疑似重复人物辅助判断；
- Genre / 名称映射辅助；
- 缺失字段检查；
- 资料治理解释。
