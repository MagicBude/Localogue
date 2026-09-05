# Localogue 项目状态

## 当前阶段

**V1-25C：Provider ID Identity / Coverage Round 2。**

V1-25A 已建立分类治理骨架；当前继续优先构建 Provider Coverage，而不是先做 Onboarding：

- 359 Canonical Genre / 43 Work Type / 51 Source-only；
- 1166 个精确 Classification Alias，其中 35 个复合/多义来源桶强制 Review；
- `localogue-community-data` 323 / 323 Classification Crosswalk；
- FANZA 260 / JAVLibrary 286 / JAVBus 9 / JAVDB 32 个当前可信 Provider Snapshot 全部达到 100%“已识别覆盖”（自动映射或明确 Review），0 Unmapped / 0 Runtime Ambiguous；
- Provider Catalog 进一步区分 Label Evidence 与 Provider ID 身份：`idSource` 才能声明 `sourceId` 归属；旧跨站 ID 无独立证据时降级为 `legacy-unscoped`；JAVDB legacy Web Filter 与现代 `/api/v2/tags` numeric ID namespace 明确分离；
- Importer 与 Genre Localization 继续数据驱动，并对 Alias 冲突 fail closed；
- `validate:vocabulary`、`vocabulary:coverage`、`vocabulary:provider-coverage` 与 `validate:provider-coverage` 成为后续 Provider 扩展的固定工具。
- Round 2 已核实 JAVBus `e/3f/7i/4/2t/1y/4o/f/6j` 9 个 ID/name 对；其中画质、作品形态和多义词继续进入 Source-only / Work Type / Review，而不是污染 Canonical Genre。


V1-24A Presentation Preference 已通过实机验收。本轮继续整理 Desktop 的资料源模型，使它从“很多散落路径设置”升级为用户可以理解和快速切换的资料库工作区：

- 新增 **Library Profile**：示例库与用户自建资料库可分别保存 Private Library、Unified Roots、额外 Media / NFO 路径与 Shared Packs；
- Profile 新建 / 切换 / 重命名 / 删除已改为立即持久化；active ID 失效时自动回退到现有 Profile，避免新增资料库后旧 Profile 消失或侧栏失去选择器；
- “添加示例库”由 Desktop Native Runtime 自动从内置资源初始化到 App Local Data，不再依赖用户先运行 pnpm 开发命令；
- 新增 Native `contractRevision=6` 防漂移检查：Webview 热更新而 Rust Binary / ACL 未重编译时，Profile 管理不会再显示假成功，而会要求重启或重编译；
- Profile metadata mutation 与普通路径设置保存分离，重命名会核对 Native 返回值后再确认持久化结果；
- 侧栏直接提供资料库下拉切换与管理入口，切换只替换当前路径配置，不复制或移动磁盘数据；
- 旧单库 Settings 会平滑迁移为 Profile；Dev Fixture 固定命名为“示例库”，普通新建库使用“资料库 1 / 资料库 2 …”中性默认名；
- `ffprobe` / Web URL 保持应用级全局设置，不被 Profile 重复保存；
- 设置页将资料源重新解释为“私人资料库（可写）/ 内容根目录（推荐）/ 只读共享资料 / 高级兼容目录”四层，高级路径默认折叠；
- 修复 Unified Sync 在多个额外媒体目录下完成状态过早的问题：一键同步现在等待所有媒体根目录真正扫描结束，并显示实际扫描目录列表；
- `MediaScanCoordinator` 增加 completion wait 能力，手工媒体扫描仍保留异步 Job / Progress / Cancel；
- Desktop Vite 使用 Rolldown vendor code splitting，而不是调大 chunk warning 阈值隐藏 bundle 膨胀；
- 标准 Dev Fixture 扩充为 **11 Works / 8 People / 43 Assets / 3 Presentation Preferences**，每部作品都有竖版海报与横版 Work Gallery、每位人物都有头像；`DEMO-002` 额外提供多图 Gallery 轮播场景；
- `LX-*` 保留高质量生成图片用于视觉/展示偏好验收，早期 `DEMO-*` 关系丰富数据并入同一可运行 Fixture；
- `DEMO-IMPORT-001 / 002` 以兼容 companion 形式恢复，LX Import/Review 场景继续保留；
- Example Library 明确同时承担开发 Fixture、手工验收、未来自动化测试和新用户功能展示；
- 新增 Library Profile / Source Model 用户文档与 ADR-040；Community Data 继续保持独立仓库，通过 Shared Pack 被 Profile 挂载，不复制进主仓库。

### 当前 V1-24B

- 修复真实资料库图片兼容回归：旧 Desktop 通过 Unified Sync 导入的 fanart / screenshot 可能没有 width / height，Hero Gallery 现在先按 Asset 角色纳入候选，再用浏览器实际解码尺寸做横版二次校验；因此既恢复真实横图画廊，也继续阻止竖版 poster / 竖图进入顶部。
- Work Presentation 的私人首图候选现在包含 poster / cover / gallery / fanart / screenshot，默认回退顺序仍保持 poster → cover → 其它作品图片；Web 与 Desktop 选择规则同步。
- Work Detail 顶部 Hero Gallery 严格只展示横版 Gallery / Fanart / Screenshot / 横版 Cover；竖版 poster 仅用于海报墙和封面，不再作为顶部画廊回退。示例库 11 部作品全部有宽幅 Gallery。
- 修复产品示例库运行副本刷新：`tauri dev` 不再优先使用旧 Resource 副本，Native Provision 会比较整棵 Fixture 的内容签名后原子刷新 App Local Data，避免模板已有横图但运行库仍只看到 Poster。
- Person Detail 已加入 Portrait / Gallery 浏览、头像/Gallery 图片导入与 Private Asset 删除治理。
- 图片导入继续经过 Native Image Picker + content-addressed Private Asset Boundary。
- Shared Pack Asset 二进制展示已接入受控 Native Source Resolver：按 `Private > Shared` 顺序绑定稳定 Asset ID 与 storagePath，只读各来源自己的 `asset-files/`，不扩大任意路径读取权限。
- Media 页新增 Private Asset Storage Health：可检查孤儿文件、Asset 引用缺失和非托管路径，并只安全清理当前 Private `asset-files/` 内真正无引用的普通文件。
- V1-24B 功能闭环完成；下一阶段进入 V1-24C Portable Pack / Presentation / Asset 迁移与冲突报告收尾。

### 当前 V1-24C

- 内置示例库现在同时 provision Private Fixture 与 Starter Shared Pack；旧版 `Private + 0 Shared` 示例 Profile 会自动补齐为 `Private + 1 Shared`，普通新建资料库不自动挂共享资料。
- Personal Portable Pack 导入前生成结构化 Import Plan，按新增 / 完全相同 / 内容冲突与 Canonical / Asset / Presentation / Audit 分类展示；冲突默认跳过，不覆盖本地。
- 导入前检查 Asset JSON、Private 二进制与 Presentation Preference 引用完整性；导入后重新检查 Asset Storage Health，并输出结构化导入报告。
- Portable UI 明确绑定当前 Library Profile，避免多资料库环境误认为备份包含其它 Profile 或全局实例设置。
- Personal Import Plan 现在还绑定生成预览时的 Private Library；若预览后切换 Profile，Webview 与 Native 双层拒绝继续导入，必须重新生成预览，避免跨库误写。
- Native Personal Import 增加 symlink / Windows Reparse Point 路径树防护；Shared Portable Pack 保持临时目录校验与原子安装。
- V1-24C 原计划随后进入 Community Pack Registry / Onboarding；V1-25B 当前先插入 Provider Coverage 收口，完成分类基础后再恢复该路线。

## V1-17 Unified Source / Desktop Interaction Parity

- `libraryRoots` 统一资料源根目录，Web / Desktop 设置语义一致；
- Unified Root + 高级媒体/NFO路径合并并按规范化文件路径去重；
- 视频、NFO、poster / cover / fanart / thumb 可以位于不同子目录；
- NFO 多段 / 多来源按番号聚合成 Work Group；
- 本地图片按文件名番号优先、同 NFO stem fallback；
- 同一次显式导入先创建 Work，再关联刚发现的本地图片；
- Native Private Asset Import 使用 SHA-256 内容寻址并校验实际图片签名；
- Work 详情可核对本地 Asset 数量、类型与存储引用；
- Shared Pack 只读边界保持不变；Shared Entity 编辑统一写 Private Override；
- Work / Person 支持 Desktop 新建、编辑与受引用保护删除；
- Work 编辑可维护 performer/director、Maker、Label、Series、Genre、Tag 关系；
- Works / People 支持核心搜索、筛选和排序；
- MediaFile 支持人工 bind / rebind / unbind，并写 `media-binding-receipts`；
- Packs 支持 Native 校验、挂载、优先级调整与卸载；
- Native 删除仅开放 works / people / assets / media-files，并执行引用检查。

## 已完成

### 资料探索

- Domain Model 与 JSON Repository；
- 三语 UI / 元数据语言回退；
- Light / Dark / System 主题；
- 作品库、作品详情、人物库、人物详情；
- 演员、导演、Maker、Label、Series、Genre、Work Type、Tag、年份、日期范围、时长、封面、本地媒体组合筛选；
- self-excluding Facet 动态计数；
- 海报墙、列表、表格三种视图；
- 已选条件 Chips；
- 作品 / 人物 URL 分页；
- 人物状态、出生 / 出道 / 引退年份、身高范围与排序；
- Maker / Label / Series 详情页与关系导航；
- 筛选侧栏响应式修复；
- 视图切换和“应用筛选”均保持合理滚动位置。

### 资料导入与治理

- `/import` JSON / NFO / CSV / XLSX 导入工作台；
- Importer Registry 与 Parser → Normalizer → Validator 分层；
- Raw / Normalized 对照预览与解析警告；
- Evidence 文件写入；
- `/review` Evidence Inbox；
- Work 番号精确识别；
- Person 全姓名类型精确匹配；
- Maker / Label / Series / Genre / Tag / Work Type 匹配；
- 字段级 `same / different / evidence_only / library_only` 对照；
- 字段级 `保留 Library / 采用 Evidence` 决策；
- 实体级 `使用匹配 / 绑定已有 / 创建新实体 / 跳过` 决策；
- Commit Plan 与 SHA-256 fingerprint 过期计划检查；
- 默认 Demo 模式禁止正式写库；
- 私人 Library 模式可创建 / 更新 Canonical JSON；
- Evidence 生命周期 `pending / committed / ignored`，生命周期与 Evidence 本体分离；
- Inbox 支持按生命周期筛选；
- ignored Evidence 禁止生成或执行 Canonical Commit。

### Provenance、历史与恢复

- Work 字段级 append-only Provenance；
- 作品详情页显示当前字段来源；
- `/history` Canonical Commit History；
- `/history/[id]` 查看完整 Operations、Evidence、fingerprint、Snapshot 与 Provenance；
- V1-07 Commit Receipt 升级为 schemaVersion 2，保存 `operations` 与 `snapshotId`；
- 正式 Commit 前创建最小 Canonical Snapshot（before-image）；
- Commit 中途失败自动恢复 Snapshot；
- 用户主动恢复时保留审计历史并新增 Restore Receipt；
- 恢复后 Evidence 自动回到 pending，可重新审核；
- 只允许按同一 Work 的最新有效 Commit 逐步恢复；
- 新建实体若已被其他 Work 引用，则阻止危险恢复；
- Snapshot 路径校验防止目录穿越；
- 新增 `pnpm validate:audit` 检查审计数据引用完整性；
- `pnpm check` 同时执行 Canonical 数据与 Audit 数据检查。

### V1-08 资料治理

- Work / Person 可解释完整度评分；
- `/curation` 治理首页；
- 缺标题、日期、时长、演员、封面、人物简介等缺失项队列；
- `/curation/evidence` pending / ignored Evidence 批量治理；
- `/people/[id]/edit` 人物资料手工编辑；
- 日中英姓名、别名/旧艺名、状态、出生资料、三围、简介、职业事件编辑；
- Person 手工编辑 before/after Receipt 与失败补偿恢复；
- `/curation/duplicates` Work / Person 可解释重复候选；
- 完整度等级与重复候选置信级别中日英受控词表。


### V1-09 设置与共享资料层

- 新增 `/settings` 实例设置中心；
- 新增 `.localogue/settings.json` 本机配置文件并 Git 忽略；
- `/settings` 可配置私人 Canonical Library 路径；
- `LOCALOGUE_LIBRARY_PATH` 继续保留最高优先级，适合 Docker / NAS / 服务器部署；
- 新增 Shared Pack 目录协议与 `localogue-pack.json` manifest；
- `/settings` 支持配置多个 Shared Pack，并显示有效/无效状态；
- JSON Repository 支持多根只读合并；
- 读取优先级固定为 `Private Library > Shared Pack（配置顺序）`；
- 同一稳定 ID 由更高优先级数据源的完整实体覆盖；
- Shared Pack 永远只读，Canonical 写入只进入私人 Library；
- Demo 仅在没有任何真实数据源时启用，避免虚构数据混入真实资料；
- CLI `validate:data / validate:audit / library:init` 开始识别网页实例设置；
- 新增 Community Data、Shared Pack、Local Override 与许可边界文档。
- 新增跨用户稳定实体 ID 规则和 Local-First 管理接口安全部署边界。

### V1-10 资源与本地媒体

- 新增 Private Asset 图片上传；
- 图片二进制使用 SHA-256 内容寻址，Asset JSON 与文件分离；
- 支持 JPEG / PNG / WebP / GIF / AVIF；用户 SVG 暂不接收；
- Asset 支持 `subjectType / subjectId`，可给 Shared Person/Work 增加本地图片而无需复制整个实体；
- 新增文件化 Presentation Preference；
- 人物支持 `preferredPortraitAssetId`，作品支持 `preferredCoverAssetId`；
- 页面显示优先级为 Presentation Preference → Canonical 默认 Asset → Placeholder；
- Shared Pack Asset 支持按真实来源根目录解析相对资源；
- 新增 `/media` 本地媒体页面；
- `/settings` 增加媒体扫描目录和 ffprobe 路径；
- 支持递归扫描常见视频格式；
- MediaFile 通过规范化番号进行保守 Work 匹配；
- ffprobe 读取实际时长、分辨率、容器、视频/音频编码；
- 可选计算完整文件 SHA-256；
- MediaFile 只从 Private Library 读取，Shared Pack 中的 media-files 永远忽略；
- “有本地影片”筛选优先从 MediaFile.workId 反查，不再要求把私人文件 ID 回写 Community Work；
- `validate:data` 开始检查 Asset subject 与 MediaFile 引用；
- `validate:audit` 开始识别 Presentation Preference。


### V1-11 MediaFile 绑定与便携资料包

- 新增 `/media/[id]` MediaFile 治理详情；
- 未识别媒体可查看可解释候选并按番号/标题手工搜索；
- 支持 bind / rebind / unbind，人工变化统一标记 `matchMethod=manual`；
- 新增 `media-binding-receipts`，保存 before/after Work 绑定和操作时间；
- `validate:audit` 开始检查 Media Binding Receipt 的结构、动作与路径上下文；
- 新增 `/packs` 资料包管理页；
- 新增 `.localogue-pack` V1 便携容器；
- Personal Pack 可导出 Canonical、Evidence/History、Presentation Preference、Asset JSON 与 asset-files；
- Personal Pack 故意不携带 MediaFile 路径、实例设置和原始视频；
- Personal Pack 导入默认只补缺失文件，不覆盖现有 Private Library；
- Shared Pack 可经过主项目 Community Validator 后导出便携包；
- Shared Portable Pack 安装前先临时解包、校验 SHA-256 与 Community Data 规则，通过后才进入 `.localogue/packs/`；
- 安装成功后自动加入 `sharedPackPaths`；
- Community Validator 与 `MagicBude/localogue-community-data` V0-01 的 typed UUIDv4、Source Record 和私人数据隔离规则对齐。

### V1-12 Platform Abstraction 与增量媒体扫描

- 新增 FileSystem / MediaProbe / FileHash / FileDialog / FileOpener Platform Ports；
- Node/Web 平台能力集中到 Infrastructure Adapter；
- Media Scan Application Core 不再直接 import Node 文件系统、路径或 child_process；
- 新增 `pnpm validate:platform` 防止平台边界回退；
- 媒体扫描升级为 size + mtime 增量 Fast Path；
- unchanged 视频不重复 ffprobe、Hash 或 JSON 写入；
- 视频改变但未成功重新分析时标记 `analysisStale`；
- 视频改变但未重新计算 Hash 时清除旧 SHA-256；
- 自动扫描明确保留 `matchMethod=manual` 的人工绑定；
- 新增 NFO / Poster / Fanart / extrafanart Sidecar Observation；
- Sidecar 变化可以独立更新，不要求视频重新分析；
- 新增 `MediaScanCoordinator` 单例后台 Job；
- `/api/media/scan` 支持 start / status / cancel；
- `/media` 显示阶段进度、增量统计、取消操作；
- 设置页显示当前 Web Runtime 原生能力缺口，为 V1-13 Tauri Adapter 做准备；
- 新增 local-javlibrary 研究记录，吸收增量扫描、单例任务和大库优化经验，但不复制 GPL 实现代码。

### V1-13 Tauri Desktop Alpha

- 新增 `pnpm-workspace.yaml` 与 `apps/desktop`；
- Desktop 使用 React 19 + Vite 8 + Tauri 2；
- 新增原生 Folder / File Picker；
- 新增 Open Path / Reveal in Folder；
- 新增 Rust ffprobe Command 与媒体技术参数解析；
- 新增 Tauri Event Progress Bridge；
- 新增 Desktop Bootstrap Settings，存储在 Tauri App Config；
- Dev / Release identifier 分离，避免开发数据污染正式桌面数据；
- 新增 Desktop CSP、应用 Permission 与 Capability；
- 不开放通用 Shell execute/spawn；
- `open_web_url` 使用 URL Parser，仅允许 localhost / 127.0.0.1；
- `open_path` 当前只允许受支持的视频文件，避免任意可执行路径被“默认打开”；
- 新增首批 Tauri FileDialog / FileOpener / MediaProbe Adapter；
- 新增 `validate:desktop` 与 Tauri prerequisites doctor。

### V1-14 Desktop Runtime Integration

- TauriFileSystemAdapter / TauriFileHashAdapter 已实现；
- Desktop 已直接复用 `MediaScanCoordinator / scanMediaLibrary`；
- Rust 提供受限目录遍历、stat、SHA-256、ffprobe 与 Private MediaFile 持久化；
- 扫描支持进度、取消、增量 fast path 与缺失文件 reconcile；
- ffprobe 采用显式路径 → `resources/bin` → PATH 的受控发现顺序。

### V1-15 Desktop Feature Parity I

- Desktop 从 Runtime Console 升级为正式 Localogue 应用壳；
- 新增 Home / Works / People / Media / Packs / Settings 六个一级页面；
- 新增 Work / Person Desktop 详情视图与关系导航；
- 新增 `TauriLibraryRepository`，按 Private > Shared Packs 合并 Canonical Entity；
- Shared Pack 由 Rust 校验 Manifest 后才进入 Desktop 读取根；
- Works / People 过滤、排序、分页与 Facet 抽为 Web/Desktop 共用 `library-query`；
- Desktop 媒体扫描使用同一合并 Repository，使 Shared Pack Work 也能参与匹配；
- Rust Canonical 集合扩大为受控只读白名单，写白名单仍严格只有 `media-files`。

### V1-16 Independent NFO Library Ingest

- 新增 `nfoScanPaths`，NFO 资料目录无需与视频同目录；
- Desktop 新增 NFO 扫描预览 / 批量导入；
- XML 番号优先，文件名番号 / 日期 / 片名 fallback；
- 同番号重复 NFO 做保守去重；
- 可创建 / 补充 Work，并精确复用或创建 Person / Maker / Label / Series / Genre / Tag；
- 已有 Work 使用 fill / merge，不静默覆盖已有核心字段；
- Rust NFO Reader 仅允许 `.nfo`、单文件 10 MB；
- Desktop Canonical 写白名单扩大到明确 Private 集合，写根由 Rust 从 Desktop Settings 强制解析，Shared Pack 仍只读；
- NFO 导入定位为显式确认的 Bootstrap Ingest：已有 Work 只 fill / merge；V1-17 已补日常 Private CRUD，完整 Evidence / Review / History 冲突治理继续留给 V1-23；
- V1-16 当时仅允许删除 Private `media-files`；V1-17 已扩展为受引用保护的 Work / Person / Asset / MediaFile 删除。
- `findWorkByCode` 兼容带 / 不带连字符番号。

## 下一阶段建议

**下一阶段：继续 Provider Coverage，暂缓 Onboarding。**

1. 获取 JAVDB `/api/v2/tags?type=0..4` 的实时完整 `category_id + id + name` 导出；
2. 找到/生成可复核的 JAVBus 完整 Genre ID 表，不把当前 35 条 verified slice 误称为全量；
3. 使用 FANZA `GenreSearch` 对目标 Adult floor 生成 ID 级快照；
4. 比较 JAVLibrary 2024 / 2025 Snapshot，标记新增、移除和改名；
5. 新来源词继续按 Genre / Work Type / Source-only / Review 分流，禁止为了覆盖率把促销、画质和平台属性升级为 Genre；
6. Provider Coverage 稳定后，再恢复 Community Pack Registry / Onboarding。

## 当前不做

- SQLite；
- 在线爬虫与 Provider；
- 外部 API Connector；
- AI Agent；
- 内置视频播放器；
- 自动搬移用户媒体文件；
- Desktop 与 Web 设置的隐式双向同步；
- 未经过许可/版本流程的 FFmpeg 二进制自动打包。

### V1-13 Webview Build Target 补充

Desktop 独立 Vite Check 已支持 Host Platform fallback：在非 Tauri CLI 场景下根据 Node `process.platform` 选择目标。Windows 使用 `chrome105`；WebKit 使用 `safari14.1`。这避免 Windows `pnpm check` 因缺少 `TAURI_ENV_PLATFORM` 而错误构建 Safari 13 bundle。


### V1-13 Desktop 构建配置确定性

Desktop Vite 配置现在以 `apps/desktop/vite.config.mts` 为唯一正式来源，所有 Vite 命令显式使用 `--config`。根 `pnpm check` 会先执行 `desktop:clean:legacy`，清理早期版本曾由 `tsc -b` 误生成的 `vite.config.js/.d.ts` 与旧 `vite.config.ts`。这解决了 ZIP 覆盖升级不会删除历史文件、导致 Validator 读取新配置而 Vite 实际执行旧配置的问题。

- V1-13 Desktop 开发服务器已按 Tauri 推荐配置忽略 `src-tauri/**`，避免 Windows Cargo/MSVC 产物与 Vite watcher 竞争导致 EBUSY。
### V1-18 实机 Hotfix 2

- Windows 扫描根不再依赖 `fs::canonicalize`，兼容可 `read_dir` 但 canonical final path 返回 OS 1005 的卷。
- 迭代扫描、junction/reparse 目录防环和后台 worker 继续保留。

- V1-24C Shared-only 可见性 Fixture 已补齐：示例 Shared Pack 中的“共享示例花”现在关联 `SHARED-DEMO-001` performer Work，不再因人物库的 performer 关系收口规则而被过滤。
