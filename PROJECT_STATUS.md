# Localogue 项目状态

## 当前阶段

**V1-24A：Desktop Presentation Preference Workbench。**

V1-24A 把已经存在于 Domain / Web 的 `PresentationPreference` 私人展示层正式接入 Tauri Desktop，并继续坚持“展示选择不是 Canonical 事实”的边界。当前阶段已：

- Curation 新增独立 Presentation 子视图，可集中管理 Work 首选封面与 Person 首选头像；
- Work Detail / Person Detail 可直接从当前实体允许的 Asset 候选中选择私人首图，并可一键恢复默认；
- Works / People 浏览结果与 Desktop Home 同步应用 Private Presentation Preference，避免不同页面显示不一致；
- Work 候选仅允许 poster / cover，Person 候选仅允许 portrait / gallery，并同时识别 Canonical 引用与 subject 归属；
- 明确检测已不存在或已脱离实体候选集的 stale preference，不静默篡改 Canonical 进行“修复”；
- 新增专用 Native Presentation Preference Reader / Writer，写根仍只能来自当前 Desktop Private Library；
- Native 删除 Asset 时新增 Presentation Preference 引用保护，必须先恢复默认展示才能删除仍被引用的私人 Asset；
- Shared Pack / Canonical 实体继续保持只读事实语义；选择私人封面或头像不会复制或改写公共实体；
- V1-23 Governance / Snapshot / Portable Pack 与 V1-18 Native I/O 稳定边界继续保持。

### 明确留到 V1-24B / V1-24C

人物 portrait / gallery 的完整上传与生命周期治理、Shared Asset 更完整的 Desktop 二进制展示来源、孤儿 Asset 清理，以及 Portable Pack 冲突预览 / 导入报告继续后续实现。

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

**V1-24B：Person Portrait / Gallery Asset Governance。**

1. 完善 Person portrait / gallery 的本地图片导入、浏览、设为头像与取消头像流程；
2. 在 Asset 管理中明确 Private / Shared 来源、归属实体、文件是否可读以及当前引用状态；
3. 增加孤儿 Asset 检测与受引用保护的安全清理，避免只删 JSON 或只留二进制文件；
4. 补齐 Shared Pack Asset 在 Desktop 的受控只读展示路径，不扩大任意文件读取权限；
5. 继续保持 Presentation Preference 只表达私人显示选择，不把个人偏好写回 Canonical / Shared Pack；
6. V1-24C 再补 Portable Pack 冲突预览、导入结果报告与 Presentation / Asset 迁移收尾。

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

