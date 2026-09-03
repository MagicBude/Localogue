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
- Review 与治理链路。

## V1.x：资料治理与 Desktop 对齐

当前已推进到 **V1-16 Desktop Feature Parity II — Independent NFO Library Ingest**。V1-13 建立 Tauri 宿主，V1-14 接通完整媒体扫描，V1-15 建立正式 Desktop 产品壳，V1-16 先解决独立 NFO 存量资料迁移。

已完成重点：

- ~~资料完整度与治理队列~~（V1-08）；
- ~~Evidence 生命周期批量治理~~（V1-08）；
- ~~人物资料手工维护~~（V1-08）；
- ~~重复作品 / 人物候选基础~~（V1-08）；
- ~~网页设置中心、Library 路径与 Shared Pack 数据分层~~（V1-09）；
- ~~Asset 上传、封面选择、Presentation Preference 与 SHA-256 内容寻址~~（V1-10）；
- ~~MediaFile 扫描、ffprobe 与可选视频哈希~~（V1-10）；
- ~~Work ↔ MediaFile 手工绑定 / 解绑与候选审核~~（V1-11 Web）；
- ~~Shared / Personal Pack 打包导入导出~~（V1-11 Web）；
- ~~Media Scan Platform Ports 与 Node/Web Adapter~~（V1-12）；
- ~~size + mtime 增量扫描、Sidecar Observation 与可取消 Scan Job~~（V1-12）；
- ~~Tauri 2 Desktop Alpha~~（V1-13）；
- ~~原生 Folder Picker / Open / Reveal / Rust ffprobe Command~~（V1-13）；
- ~~完整 Tauri FileSystem / FileHash Adapter 与 MediaScanCoordinator~~（V1-14）；
- ~~Desktop Home / Works / People / Media / Packs / Settings 正式应用壳~~（V1-15）；
- ~~Private + Shared Pack Desktop 合并浏览~~（V1-15）；
- ~~Web / Desktop 共享 Works / People Query Core~~（V1-15）；
- ~~独立 `nfoScanPaths` 与 NFO Preview / Explicit Import~~（V1-16）；
- ~~XML 番号优先 + 文件名番号 / 日期 / 片名 fallback~~（V1-16）；
- ~~Private-only Native Canonical Writer 与 media-only 删除边界~~（V1-16）。

### V1-17：Desktop Interaction Parity / Governance

下一阶段重点：

- Desktop 高级 Works / People Facet、排序、分页与更多实体浏览；
- Canonical Work / Person 编辑与既有 Commit Plan / Audit 规则接入；
- Evidence / Review / Curation / History Desktop 交互；
- 将 V1-16 NFO Bootstrap 中的冲突型更新继续收敛到完整治理链；
- MediaFile bind / rebind / unbind 审计；
- Shared / Personal Portable Pack Desktop 导入导出；
- Asset 二进制读取、头像/封面与 Presentation Preference；
- 继续抽取共享 Presentation/DTO，避免 Web/Desktop 重复业务规则。

### 后续 Desktop Native Enhancement

- Native Pack Open / Save Dialog 与拖放；
- ffprobe Sidecar target-triple 获取、版本、License、Hash 与发行流程；
- 安装器、签名和自动更新；
- Asset 孤儿治理与安全删除；
- Community Pack 更新检查、版本升级与冲突预览。

同时继续保留：

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
