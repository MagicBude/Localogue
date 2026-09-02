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

已进入此阶段。V1-13 已完成 Tauri Desktop Alpha 的第一条原生纵向链路，下一阶段进入 Desktop Runtime Integration。

后续重点：

- ~~资料完整度与治理队列~~（V1-08）；
- ~~Evidence 生命周期批量治理~~（V1-08）；
- ~~人物资料手工维护~~（V1-08）；
- ~~重复作品 / 人物候选基础~~（V1-08）；
- ~~网页设置中心、Library 路径与 Shared Pack 数据分层~~（V1-09）；
- ~~Asset 上传、封面选择、Presentation Preference 与 SHA-256 内容寻址~~（V1-10）；
- ~~MediaFile 扫描、ffprobe 与可选视频哈希~~（V1-10）；
- ~~Work ↔ MediaFile 手工绑定 / 解绑与候选审核~~（V1-11）；
- Asset 图集、孤儿资源和安全删除治理；
- Community Pack 更新检查、版本升级与冲突预览；
- ~~Shared / Personal Pack 打包导入导出~~（V1-11）；
- ~~Media Scan Platform Ports 与 Node/Web Adapter~~（V1-12）；
- ~~size + mtime 增量扫描、Sidecar Observation 与可取消 Scan Job~~（V1-12）；
- ~~Tauri 2 Desktop Alpha（V1-13）~~；
- ~~原生 Folder Picker / Open / Reveal / Rust ffprobe Command（V1-13）~~；
- 完整 Tauri FileSystem / FileHash Adapter 与 ScanCoordinator Event Bridge（V1-14）；
- ffprobe Sidecar target-triple 打包与 Binary Dependency 流程（V1-14）；
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
