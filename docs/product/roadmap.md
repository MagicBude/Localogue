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

当前已推进到 **V1-19 Desktop Discovery & Presentation Parity**。V1-18 补齐真实本地图片展示、Works 三视图和 Unified Library 同步；V1-19 继续关闭 Web/Desktop 日常浏览差距，把首页海报、完整 Work Facet、People 高级筛选、Person 相关作品二次筛选和分类浏览接入 Desktop。

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
- ~~Private-only Native Canonical Writer 与 media-only 删除边界~~（V1-16）；
- ~~`libraryRoots` Unified Library Source 与跨子目录视频/NFO发现~~（V1-17）；
- ~~同番号 NFO Work Group 预览~~（V1-17）；
- ~~poster / cover / fanart / thumb 本地 Asset Preview / Explicit Import~~（V1-17）；
- ~~Native 图片格式校验、SHA-256 内容寻址与 Private-only Asset Writer~~（V1-17）；
- ~~Desktop Work / Person Private CRUD 与 Shared Entity Private Override~~（V1-17）；
- ~~Desktop Works / People 核心搜索、筛选、排序~~（V1-17）；
- ~~Shared Pack 挂载、Native 校验、优先级调整、卸载~~（V1-17）；
- ~~Work 元数据关系编辑~~（V1-17）；
- ~~MediaFile bind / rebind / unbind 与审计 Receipt~~（V1-17）；
- ~~Desktop Works 海报墙 / 列表 / 表格三视图~~（V1-18）；
- ~~Private poster / cover 受限 Native IPC 实际展示~~（V1-18）；
- ~~Unified Library NFO → Asset → Media 一键显式同步~~（V1-18）；
- ~~Desktop 首页最近作品真实海报~~（V1-19）；
- ~~Desktop Works 完整多维 Facet 与已选筛选 Chips~~（V1-19）；
- ~~Desktop People 高级筛选~~（V1-19）；
- ~~Person Detail 相关作品海报 / 三视图 / 二次 Facet~~（V1-19）；
- ~~Desktop Maker / Label / Series / Genre / Director / Work Type / Tag 分类浏览~~（V1-19）。

### V1-19：Desktop Discovery & Presentation Parity

本阶段完成日常浏览对齐：完整 Work Facet、People 高级筛选、Person 相关作品二次筛选、首页/关联作品海报和分类浏览。

### V1-20：Desktop Governance Parity

下一阶段重点：

- 将 Desktop Private CRUD 接入既有 Commit Plan / Audit / History 治理规则；
- Evidence / Review / Curation / History Desktop 交互；
- Bootstrap Ingest 冲突型更新收敛到完整治理链；
- Shared / Personal Portable Pack Desktop 导入导出；
- Presentation Preference Workbench 与更多人物 Asset 管理；
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
