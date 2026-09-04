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

当前已推进到 **V1-23 Desktop Governance Parity**。V1-23 将 Evidence / Review / Commit Plan、Curation、History / Restore 与 Personal / Shared Portable Pack 的治理基线迁入 Tauri Desktop，同时保持 Shared Pack Native 只读和 Private Snapshot 安全边界。

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
- ~~Desktop Sidebar 默认收窄、可折叠并持久化~~（V1-20）；
- ~~Desktop Facet Rail 加宽与长选项换行~~（V1-20）；
- ~~poster / fanart / screenshot / cover 用户语义与展示顺序统一~~（V1-20）；
- ~~Desktop UI / Metadata 中日英独立语言偏好~~（V1-20）；
- ~~NFO 混合分类 Vocabulary Routing 与 unmapped policy~~（V1-21）；
- ~~早期 NFO Genre / Tag 污染 Preview → Explicit Repair~~（V1-21）；
- ~~Desktop Work Detail 分开展示 Work Type / Genre / Tag~~（V1-21）；
- ~~Desktop stale-while-refresh，筛选 / 分页 / 切语言保持滚动位置~~（V1-22）；
- ~~Genre 多语与来源别名治理~~（V1-22；Hotfix 3 改为 33 个 Canonical Genre + 67 条 Approved Source Aliases，不保留完整 1271 条参考表）；
- ~~Desktop Work Detail 高密度“海报 + Metadata Table”信息架构~~（V1-22）。
- ~~Desktop Evidence Inbox / 字段与实体 Review / Commit Plan~~（V1-23）；
- ~~Desktop Native before-image Snapshot / Commit 失败自动恢复~~（V1-23）；
- ~~Desktop Curation Completeness / Duplicate Candidates~~（V1-23）；
- ~~Desktop History / Restore Receipt / Provenance~~（V1-23）；
- ~~Desktop Personal Backup / Shared Library Portable Pack 导入导出~~（V1-23）。

### V1-19：Desktop Discovery & Presentation Parity

本阶段完成日常浏览对齐：完整 Work Facet、People 高级筛选、Person 相关作品二次筛选、首页/关联作品海报和分类浏览。

### V1-20：Desktop UX & I18N Parity

本阶段完成 Desktop 布局和三语 Presentation 对齐：可折叠窄 Sidebar、宽 Facet Rail、Asset 语义/顺序，以及独立 UI / Metadata Language。

### V1-21：Vocabulary Governance & Work Metadata Visibility

本阶段先修复真实来源词表问题：受控 NFO 分类映射、历史分类审计/修复、Work Detail 分类展示。

### V1-22：Desktop Information Architecture & Metadata Localization

本阶段修复筛选 / 分页 / 切语言时的滚动回跳，统一受控枚举与 Genre 多语展示，并把 Work Detail 重构为高密度信息表。完整外部 Genre 参考表不进入仓库；仅保留人工批准来源别名，不绕过 Canonical Vocabulary 映射边界。

### V1-23：Desktop Governance Parity

本阶段完成 Evidence → Review → Commit Plan → Native Snapshot → Commit、Curation、History / Restore，以及 Shared / Personal Portable Pack Desktop 导入导出。Desktop 治理规则继续复用 Web Application Core，真实写权限由 Rust Private Boundary 控制。

### V1-24：Desktop Personal Presentation & Asset Governance（后续）

下一阶段候选：

- Presentation Preference Workbench；
- 人物 portrait / gallery Asset 更完整管理；
- Work Hero / cover 用户偏好治理；
- Portable / Shared Pack 冲突预览进一步增强；
- 继续抽取共享 Presentation/DTO，避免 Web/Desktop 重复表现逻辑。

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
