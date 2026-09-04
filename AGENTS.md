# Localogue AI / Agent 协作说明

本文件用于约束后续参与 Localogue 的 AI、Agent 和开发者。任何实现方案在修改代码或数据结构前，都应先阅读本文件及 `docs/README.md`。

## 一、当前阶段

当前阶段：**V1-24 Foundation Cleanup：Library Profiles / Source Model / Rich Fixture**。

V1 当前约束：

- 使用 JSON Repository，不引入 SQLite / ORM；
- 不接入在线爬虫或必须联网的数据源；
- 不实现播放器、转码和复杂微服务；
- 不用临时代码绕开既有 Domain Model；
- 新页面不得直接读取文件系统；
- 优先把浏览、筛选、人物档案和资料治理体验做完整。

## 二、必须遵守的架构不变量

1. **Canonical Library 是唯一最终真相源。**
2. **外部导入内容先形成 Evidence，再经过规范化、匹配与审核。**
3. **任何 Importer / Connector 都不得直接无条件覆盖 Canonical Library。**
4. **Work 与 MediaFile 必须分离。** 一个作品可以没有本地文件，也可以关联多个媒体文件。
5. **Person 是统一人物实体。** 演员、导演等由关系角色区分，UI 可以按“女优”“导演”展示。
6. **原始语言内容不可被翻译覆盖。** 日本作品默认以日文原文为主要元数据。
7. **本地化名称、罗马字、旧艺名、曾用名、别名必须区分语义。**
8. **Work Type、Genre、Tag 必须分开。**
9. **关键关系必须结构化。** 禁止为了省事把演员、类型、系列等关系存成逗号拼接字符串作为最终模型。
10. **V1 的 JSON 只是持久化实现，不是 Domain Model 本身。**
11. **页面和业务逻辑不得直接散落读取 JSON 文件。** 应通过 Repository / Query Service 抽象。
12. **默认文件策略必须非破坏性。** 未经用户明确选择，不移动、重命名、删除原始媒体。
13. **筛选、排序和反向导航是一级产品能力。** 不能只做“列表 + 搜索框”。
14. **所有核心功能应离线可运行。**

## 三、语言约定

- 项目文档正文：中文；
- UI 默认可设置日文、简体中文、英文；
- 元数据原文：日本作品默认 `ja`；
- 程序内部 ID、字段名、枚举 ID：英文小写、稳定、不可随翻译变化；
- Git Commit：推荐中文 Conventional Commit，例如：
  - `docs: 初始化 Localogue V0 设计规范`
  - `feat: 增加作品多维筛选`
  - `fix: 修复人物别名匹配`

## 四、修改数据模型前

必须检查：

- `docs/data-model/`
- `docs/vocabulary/`
- `docs/architecture/`
- `docs/decisions/`

如果新需求会改变核心原则，应新建 ADR，而不是直接修改实现后再补文档。

## 五、文档同步规则

功能变化至少同步以下一项：

- 产品行为变化 → `docs/product/` 或 `docs/ui/`
- 数据结构变化 → `docs/data-model/`
- 枚举 / 术语变化 → `docs/vocabulary/` 与 `resources/vocabularies/`
- 导入格式变化 → `docs/import/` 与 `schemas/`
- 架构选择变化 → `docs/decisions/`
- 阶段进度变化 → `PROJECT_STATUS.md` 与 `CHANGELOG.md`
- 根目录只维护一个当前版本说明 `MANIFEST.md`，新版本直接覆盖更新；禁止继续新增 `V*_MANIFEST.md`、`*_HOTFIX_MANIFEST.md` 等版本快照文件。历史变化由 `CHANGELOG.md`、Git Commit 与版本标签承担。
- 覆盖式补丁只交付实际修改/新增的文件；需要删除的旧文件在交付说明中单独列出，不为每个补丁长期保留额外 README / Manifest。

## 六、代码可学习性

本项目由用户边开发边学习网页、数据库和软件架构，因此代码必须兼顾可维护性和教学价值：

- TypeScript 类型尽量明确，避免大量 `any`；
- 关键文件写中文模块级注释，说明职责和设计原因；
- 复杂算法解释“为什么这样做”，而不是逐行复述语法；
- React Server Component / Client Component 的边界应在首次出现处说明；
- Repository、Query、Domain 等架构概念出现时同步维护 `docs/development/` 教材；
- 不为了少写几行代码而牺牲可读性；
- 不滥用注释，显而易见的赋值和 JSX 标签无需逐行注释。

## 七、不要过度工程化

Localogue 的目标不是为了展示技术复杂度。优先级始终是：

**数据可信 > 浏览体验 > 可维护性 > 自动化程度 > 技术炫技。**


## V1-02 新增实现约束

- Facet 计数采用 self-excluding 语义；新增筛选维度时必须同步考虑该维度的 Facet 统计。
- Grid / List / Table 只是同一查询结果的不同表现层，不得各自实现独立数据查询。
- 筛选、排序、视图等可导航状态优先保存在 URL，不要无理由改成仅存在浏览器内存的 React state。
- 分类索引页最终应进入统一 WorkQuery，不另造一套作品过滤逻辑。
- 新增关键实现时继续补充中文学习文档，并说明“为什么这样设计”。

## V1-03 实现约束补充

- 筛选器必须保持响应式，不允许因为日期控件、Select 或长文本产生侧栏横向滚动；
- 作品视图切换属于“展示状态变化”，不得强制用户回到页面顶部；
- 分页、筛选、排序、视图继续使用 URL 作为状态源；
- 新增筛选条件时，需要考虑已选条件 Chips 如何显示和移除；
- 修改筛选条件后应回到第 1 页，防止旧页码超出新结果范围；
- 人物搜索必须覆盖 `Person.names` 中所有姓名类型，不得只搜索 primary name；
- Maker、Label、Series 等关系实体应支持详情页和反向导航，而不仅用于 `<select>`；
- 继续保持教材级中文注释：重点解释设计原因、Web 原理和未来 SQLite 映射，不写无意义逐行翻译式注释。


## V1-04 实现约束补充

- 点击“应用筛选”属于条件更新，不应把用户强制送回页面顶部；URL 仍然是筛选状态真相源。
- Importer 只负责把外部格式解析为 Evidence Candidate，不得直接创建或覆盖 Canonical Work / Person。
- Parser、Normalizer、Validator、Entity Resolution、Review 必须保持职责分离。
- 未匹配的人物、厂商、系列、Genre 在 Evidence 阶段允许保留来源字符串，禁止 Parser 为了方便伪造内部 ID。
- 导入真实数据默认写入 `data/library` 或 `LOCALOGUE_LIBRARY_PATH`，不得写入公开 `data/demo-library`。
- 新增导入格式时必须同步 `docs/import/`、示例文件和必要的解析警告说明。


## V1-05 实现约束补充

- Evidence 是来源历史记录，Review Analysis 应根据“当前 Evidence + 当前 Canonical Library”重新计算，不把临时匹配结果写死回 Evidence。
- 自动 Entity Resolution 只能使用保守、可解释的规范化精确匹配；模糊候选可以未来作为建议，但不得自动绑定。
- Person 匹配必须覆盖 `Person.names` 的全部姓名类型，避免旧艺名和别名造成重复人物。
- Organization 匹配必须先限制 `kind`，Maker 不得跨到 Label / Agency 中猜测。
- `evidence_only` 不等于“自动补全”，`library_only` 更不等于“应删除”；所有字段差异必须等待 Review Decision。
- V1-05 Review 页面只展示分析，不得添加绕过字段决策的“一键覆盖资料库”逻辑。
- 新增 Review / Resolution 状态时，要同步 Domain Type、三语 UI 映射和治理文档。
- V1-06 如果开始正式写 Canonical Library，必须先设计 Commit Plan 与失败回滚/原子写入策略。


## V1-06 实现约束补充

- 默认 `data/demo-library` 是只读教学资料，不得通过 Review/Commit API 修改。
- 任何 Canonical 写入必须要求显式私人 Library 配置（`LOCALOGUE_LIBRARY_PATH` 或 `/settings` 保存的 `libraryPath`），保证读写目标是同一个私人 Library。
- Review Analysis、Review Decisions、Commit Plan、Commit Executor 必须保持分层，禁止在 React 页面中直接调用文件写入。
- ambiguous / unresolved 实体不得拥有自动绑定默认值；没有人工明确决策时必须产生 blocker。
- Work Type 属于受控词表，未知输入不得自动生成新的 Work Type ID。
- Commit 执行前必须重新生成 Plan 并比较 fingerprint，不能信任浏览器持有的旧计划。
- JSON V1 跨文件写入不具备 ACID Transaction；写入顺序必须优先保证引用安全，并保存 Commit Receipt。
- 新增正式写入能力时必须同步 `docs/architecture/commit-plan.md`、相关 ADR 和教材文档。


## V1-07 实现约束补充

- Evidence Raw / Normalized 内容视为不可变来源记录；审核生命周期必须使用独立 `evidence-lifecycle` 状态，不得为了“已忽略”直接改写 Evidence。
- Provenance 使用追加式事件历史，不得只保存一个可被覆盖的“当前来源”字段。
- Commit Receipt 属于审计日志；成功 Commit 即使以后恢复也不能删除 Receipt。
- V1-07 新 Commit 必须在正式写入前创建最小 Snapshot，并把 `snapshotId` 写入 Receipt。
- Commit 中途失败时必须尝试自动恢复 Snapshot；不能留下明知不完整的半提交状态后仍返回成功。
- 用户主动恢复与失败自动回滚语义不同：主动恢复必须保留原 Provenance，并追加 restored 事件和 Restore Receipt。
- 历史恢复只能从同一 Work 的最新有效 Commit 开始；不得直接恢复较旧版本覆盖后续修改。
- 恢复将删除本次 Commit 新建实体前，必须检查它们是否已被其他 Work 引用；存在引用时必须阻塞恢复。
- Snapshot 中的 relativePath 必须经过路径越界检查，禁止绝对路径和 `..`。
- 审计数据变化必须同步 `pnpm validate:audit` 规则、Schema 示例和中文文档。
- JSON Snapshot 只是 V1 的补偿式恢复机制，不得把它描述成 SQLite/数据库 ACID Transaction。


## V1-08 实现约束补充

- Completeness 是可重算的治理信号，不得写进 Canonical Entity 当作真相字段。
- “资料完整”不代表“资料正确”；真实性继续由 Evidence、Review 与 Provenance 负责。
- Work 完整度不得因为没有 MediaFile 扣分，继续维护 Work / MediaFile 分离原则。
- DuplicateCandidate 只能作为人工检查队列，任何候选规则都不得直接触发自动 merge。
- 人物重复检测继续优先使用精确姓名/别名与出生日期等可解释信号，不得引入静默模糊合并。
- 人物 Web 手工编辑必须只允许私人 Library，并经过服务端 DTO 校验；页面不得直接写 JSON 文件。
- 人物手工编辑必须保留 before/after 审计 Receipt；Receipt 写入失败时应尝试补偿恢复。
- Evidence 批量动作只修改 Lifecycle，不得批量改写 Evidence Raw / Normalized 本体。
- 新增治理规则时必须同步 `docs/curation/`，若涉及稳定状态或等级应同步受控词表。


## V1-09 实现约束补充

- 普通用户的实例配置默认通过 `/settings` 管理，保存在 Git 忽略的 `.localogue/settings.json`。
- `LOCALOGUE_LIBRARY_PATH` 保留给 Docker / NAS / 服务器等部署场景，并且优先于网页设置。
- Shared Pack 必须视为只读基础资料，任何 Repository 写入都只能进入显式配置的 Private Library。
- 读取优先级固定为 `Private Library > Shared Pack（配置顺序）`；同一稳定 ID 由靠前数据源胜出。
- Demo Library 只能在没有 Private Library 且没有有效 Shared Pack 时使用；禁止把虚构 Demo 当真实数据层 fallback。
- Shared Pack V1 使用整实体覆盖语义，不得偷偷实现不可解释的字段级深度合并。
- 社区公共资料与主程序仓库应保持逻辑分离；真实共享数据必须考虑来源、许可与 Provenance。
- “用户喜欢的头像/封面”属于 Presentation Preference，不应等同于修改公共事实元数据；Asset 阶段应实现独立本地偏好层。
- CLI 校验脚本必须和 Next.js 使用相同的 Library / Shared Pack 路径解析规则。


## V1-10 实现约束补充

- Presentation Preference 属于“怎样显示”的私人偏好，不得因为选头像/封面就强迫复制整个 Shared Person / Work。
- 本地上传 Asset 应使用 `subjectType / subjectId` 建立归属；共享 Canonical Asset 继续通过 Person/Work 原有引用建立归属。
- 用户上传图片必须落入 Private Library；Shared Pack 永远只读。
- Asset 二进制与 Asset JSON 分离，用户上传图片使用 SHA-256 内容寻址；禁止把大体积 Base64 图片塞进 JSON。
- 未实现可靠清洗器前，不接受用户上传 SVG；内置受控 SVG Demo 不受此限制。
- Asset 内容路径必须经过资料根路径越界检查，禁止 `..` 逃逸。
- MediaFile 永远属于 Private Layer；Shared Pack 中即使存在 `media-files/` 也必须忽略。
- Work 与 MediaFile 的本地关联以 `MediaFile.workId` 为主，不应为了本地文件状态复制/覆盖 Community Work。
- 未识别 MediaFile 是合法状态，禁止扫描器为了提高命中率进行不可解释的模糊自动绑定。
- ffprobe 必须通过参数数组调用，不拼接 Shell 命令字符串。
- 视频 SHA-256 是高成本操作，默认不得在普通扫描中强制启用。
- 目录扫描当前是 V1 同步实现；数据规模增大后应升级 Job / Worker，而不是无限增加 HTTP 请求时长。


## V1-11 实现约束补充

- 未识别 MediaFile 是合法状态；候选搜索可以提供建议，但没有用户明确确认不得写入 `workId`。
- MediaFile 人工 bind / rebind / unbind 必须经过 Application Service，并保留 `media-binding-receipts` 审计记录。
- `.localogue-pack` 只是传输容器，不是新的 Canonical Domain Model；不要让页面依赖 gzip/Envelope 细节。
- Portable Pack 内所有路径必须拒绝绝对路径、空路径和 `..`；每个文件必须校验 size + SHA-256。
- Personal Pack 默认不覆盖已有私人文件；未来需要覆盖时必须先设计显式 Import Plan / 冲突决策。
- Personal Pack 不得打包原始视频、MediaFile 本机路径或 `.localogue/settings.json`。
- Shared Portable Pack 安装必须先写临时目录并通过 Community Validator，校验失败不得进入正式 Shared Pack 路径。
- `localogue-community-data` 的仓库 CI 是 Community Data 发布最终权威；Localogue 内置 Validator 是安装前防线，规则应保持兼容但不要擅自放宽正式社区约束。
- V1-11 Portable Pack 当前为内存型、单包 256 MB 上限；不要通过简单放大限制代替未来流式 Job / Archive 实现。

## V1-12 实现约束补充

- Media Scan Application Core 不得直接依赖 `node:fs`、`node:path`、`child_process` 或其它平台专用模块；必须通过 Platform Ports。
- `pnpm validate:platform` 用于防止 Media Scan 平台边界回退，新增扫描能力时必须保持该检查通过。
- 自动扫描使用 `fileSize + fileModifiedAt` 作为 V1 廉价变化指纹；未变化视频不得重复执行 ffprobe、完整 SHA-256 或无意义 JSON 重写。
- 视频文件改变但没有成功重新分析时，旧技术参数必须标记为 stale；旧 SHA-256 不得继续冒充当前文件 Hash。
- `matchMethod=manual` 表示人工治理决定，自动扫描不得覆盖人工 Work 绑定。
- NFO / Poster / Fanart 只能作为 Sidecar Observation；扫描器不得绕过 Evidence / Asset 治理直接修改 Canonical Work。
- Snapshot Diff / Reconcile 是本地媒体同步基线；未来 FileSystem Watcher 只能作为实时增强，不得成为唯一真相来源。
- 同一运行时同时只允许一个 Media Scan Job；重复触发必须拒绝或复用，不得并发启动多轮 ffprobe / Hash。
- Media Scan Job 必须支持可观察状态和取消；不要重新退回“一个 HTTP 请求同步等待整个大目录扫描”的模式。
- V1-13 Tauri Desktop 应实现已有 Platform Ports，而不是在 UI 组件中直接调用 Tauri API 重写业务规则。


## V1-13 实现约束补充

- Web 与 Desktop 现在是两个运行入口，但必须共享同一 Domain / Application 规则；不得在 Tauri UI 中复制一套 Canonical / Evidence / Review 业务逻辑。
- `apps/desktop` 是独立 Vite + Tauri Workspace Package；根 Next.js Web 继续保留。
- Tauri Webview 不得获得通用 `shell execute/spawn` 权限；任何本地进程能力必须通过最小化 Rust Command 暴露。
- `probe_media` 只允许执行文件名为 `ffprobe` / `ffprobe.exe` 的程序，并使用固定参数数组，不经过 Shell。
- Desktop 自定义 Command 必须通过 `src-tauri/permissions/` 显式授权，并由主窗口 Capability 引用。
- Desktop 必须启用 CSP，禁止以 `csp=null` 作为长期解决方案。
- Dev / Release 必须使用不同 Tauri identifier，保证 App Config / AppData 隔离。
- V1-13 Desktop Bootstrap Settings 与 Web `.localogue/settings.json` 暂时分离；不得假装二者已经实现双向同步。
- V1-13 只完成 Native Dialog / Open / Reveal / MediaProbe 首批 Adapter；FileSystem / FileHash 与完整 ScanCoordinator 迁移放到 V1-14。
- ffprobe 打包 Sidecar 在 V1-14 处理 target-triple、版本和再分发边界后再启用；V1-13 不允许配置一个不存在的 `externalBin` 让构建默认失败。

## V1-14 实现约束补充

- Desktop 必须复用 `scanMediaLibrary` 与 `MediaScanCoordinator`，不得在 React UI 或 Rust 中复制增量比较、匹配和 stale 规则。
- Tauri FileSystem / FileHash 只能通过最小 Commands 实现；Webview 继续不得获得通用 Shell 能力。
- Desktop 扫描专用 Repository 只允许读取 `works` 和读写私人 `media-files`，不得扩大为任意集合文件 API。
- Web 与 Desktop 设置字段语义保持一致；两个运行入口可以拥有不同本机设置文件，但 UI/文档不得把它描述为两套产品规则。
- Desktop Scan 取消以 Application `AbortSignal` 为真相源；单个原生 IO 调用完成后必须再次检查取消状态。
- ffprobe 查找顺序为显式用户路径、发行包 `resources/bin`、系统 PATH；所有候选仍须通过 basename 白名单。
- 未准备齐 target-triple 二进制、许可证与校验摘要前，不得配置不存在的 Tauri `externalBin`。
- 修改 Desktop Runtime 边界后必须运行 `pnpm validate:desktop`；有 Rust/Tauri 环境时另外运行 `pnpm desktop:doctor` 与 `pnpm desktop:dev`。

## V1-15 实现约束补充

- Web 与 Desktop 可以使用不同存储 Adapter，但 Works / People 的过滤、排序、分页与 Facet 语义必须复用 `src/application/library/library-query.ts`；不得在两个宿主各维护一套查询规则。
- Desktop Canonical 浏览通过 `TauriLibraryRepository` 统一进入 `LibraryRepository`；React 页面不得直接拼接资料目录或逐文件读取 JSON。
- Desktop 读取优先级固定为 `Private Library > Shared Pack 1 > Shared Pack 2 > …`，同一稳定 ID 仍采用高优先级完整实体覆盖。
- Shared Pack 必须先由 Rust Native Boundary 校验 `localogue-pack.json`、`schemaVersion=1`、`kind=shared-library` 与 `library/` 目录；无效 Pack 不得加入 Repository 读取根。
- V1-15 允许 Desktop 只读 `works / people / organizations / series / genres / tags / assets`，`media-files` 仍只属于 Private Layer；Canonical 治理写入暂不开放。
- Rust 写集合白名单必须继续只有 `media-files`。扩大读取能力不等于扩大写权限，更不得演变成 Webview 可指定任意目录/集合的通用文件 API。
- Desktop 媒体扫描必须使用与浏览页面相同的合并 Repository，使 Shared Pack Work 能参与番号匹配，但扫描产生的 MediaFile 只能写入 Private Library。
- V1-15 的 Home / Works / People / Media / Packs / Settings 是正式 Desktop 产品壳，不再把 Desktop 视为 Runtime 测试控制台。
- V1-17 在 V1-16 NFO Bootstrap 上增加 Unified Library Root、NFO Work Group、本地 Asset Ingest，并完成 Work/Person Private CRUD、核心筛选排序、Shared Pack 管理和 Media 人工绑定审计；Evidence/Review/History/Portable Pack 等重治理工作台继续留给 V1-23。不要为了追求表面 parity 把 Next.js Route Handler 或 Node 文件 API 直接复制进 Tauri Webview。


## V1-17 实现约束补充

- `mediaScanPaths` 与 `nfoScanPaths` 是两个独立概念：前者发现本地视频，后者提供 NFO 元数据；禁止重新引入“必须与视频同目录/同名”的假设。
- NFO 识别必须优先使用 XML 内可验证的番号；XML 缺失或只有无关数字 ID 时，才从文件名保守识别番号。日期和片名只能作为缺失字段 fallback。
- Desktop 批量 NFO 必须保持 **Preview -> Explicit Import**。扫描预览本身不得写 Canonical。
- V1-16/V1-17 的 NFO / Local Asset Bootstrap Ingest 是对“所有外部导入先持久化 Evidence 再 Review”的一个**窄范围迁移例外**：只服务用户明确确认的本地存量资料打底；已有 Work 只能 fill / merge 缺失字段和精确关系，不得静默覆盖已有核心事实。不要把这个例外推广到在线 Provider、普通 Importer 或一般编辑。
- V1-23 再把更广泛的冲突修改、Evidence / Review / Commit Plan / History 与 Portable Pack 治理链迁入 Desktop；V1-17/V1-18 的直接 Private CRUD 是本地私人层日常维护能力，不等价于完整 Evidence 审核治理。
- Native Canonical Writer 的根目录必须由 Rust 从当前 Desktop Settings 自行解析，只能是已配置的 Private Library；Webview 不得传入任意写根目录。Shared Pack 必须在 Rust 边界保持只读。
- V1-17 允许写 `works / people / organizations / series / genres / tags / assets / media-files`；Asset 二进制只能通过受限 Native 图片导入写入 Private `asset-files/`，不得接受任意写根。删除仅开放 `works / people / assets / media-files` 且必须通过 Native 引用检查；另有独立 Audit Writer 只允许 `media-binding-receipts`。
- `libraryRoots` 是统一资料源的首选配置；`mediaScanPaths / nfoScanPaths` 只作为高级兼容补充。目录位置不得成为 Work/NFO/Media/Asset 的关系主键，可靠关联优先使用规范化作品番号。
- 自动 Local Asset Import 必须保守：只有明确 poster / cover / fanart / thumb 等角色后缀时才自动导入，避免把截图、素材等普通 JPG 静默挂到 Work。目录名没有媒体语义，`写真/` 等分类目录中的受支持视频必须照常扫描。
- 新建 Person / Organization / Series / Genre / Tag 只允许规范化精确复用或稳定 ID 创建，不做模糊别名自动合并。
- NFO 创建 / 补充 Work 后，媒体关联仍走既有番号匹配器；不得为了 NFO 再写第二套 MediaFile 绑定规则。
- 修改 NFO / Desktop Native 写边界后必须运行 `pnpm validate:platform` 与 `pnpm validate:desktop`；有 Rust/Tauri 环境时继续运行 `pnpm desktop:rust:check`。

## V1-18 实现约束补充

- Desktop 本地图片展示不得通过动态 Private Library 开启宽泛 `asset://` scope；必须使用受限 Native Reader，并由 Rust 从当前 Settings 解析 Private `asset-files/` 根。
- `read_private_asset_bytes` 不得接受绝对路径、路径穿越或 Shared Pack 路径；扩展名、大小与 magic bytes 校验不能只放在 React。
- Works 海报墙 / 列表 / 表格只能是同一查询结果的 Presentation 切换，不得为三个视图复制三套 Repository 查询和过滤逻辑。
- Unified Library 一键同步顺序固定为 NFO → Asset → Media；Asset 必须在 NFO Import 后重新发现，确保新建 Work 可立即成为图片关联目标。
- 一键同步仍然是用户显式操作；不得把 NFO / Asset Canonical 写入改成后台静默扫描。高级 Preview / Import 入口必须保留。
- V1-18 解决 Presentation 与同步编排；V1-19 已补完整高级 Facet / People Filter / Catalog Browse。Evidence / Review / Curation / History 与 Portable Pack 完整治理继续进入 V1-23。



### V1-13 Desktop Open 边界

- `open_web_url` 使用 URL Parser 校验，当前只允许 `http://localhost` 与 `http://127.0.0.1`，不能只依赖字符串前缀。
- `open_path` 当前只允许 Localogue 支持的视频扩展名，避免 Webview 将“默认程序打开”能力扩大成打开 `.exe` / 脚本等任意可执行目标。
- `reveal_in_folder` 只负责在系统文件管理器中定位已经存在的路径，不执行目标。
- 通用 Shell execute/spawn 仍不向 Webview 暴露。


## V1-18 Hotfix 3 Native I/O 约束

- Tauri Native Command 调用链禁止使用数百 KiB/1 MiB 级固定栈数组处理文件；流式文件缓冲必须优先使用堆分配。
- 高频文件 I/O、Hash、Canonical JSON 读写必须使用 async command + blocking worker，不得重新压回 Tauri main thread。
- `scripts/validate-desktop-boundaries.mjs` 对以上边界有自动回归检查。


## V1-19 Desktop Discovery Parity 约束

- 首页、Works、Person Detail 相关作品必须复用 `DesktopWorkResults` / `DesktopWorkExplorer`，禁止重新引入无 Asset 的占位 WorkTile。
- Desktop Work 多维筛选必须通过 `TauriLibraryRepository -> queryWorks`，禁止在组件里重新实现匹配业务规则。
- Person Detail 的人物条件是固定查询上下文，其余 Work Facet 可继续组合。
- People 高级筛选继续复用 `queryPeople`；Desktop UI state 可以不同于 Web URL，但 Query 语义必须一致。
- Browse 目录只负责生成 WorkQuery 入口，不建立第二套 Catalog 数据模型。
- Evidence / Review / Curation / History / Portable Pack 完整治理继续进入 V1-23。

## V1-20 Desktop UX / I18N Parity 约束

- UI Language 与 Metadata Language 必须独立；支持值与 Web 保持 `ja / zh-CN / en`，默认 UI `zh-CN`、Metadata `ja`。
- Desktop 可以用 localStorage，而 Web 可以继续用 Cookie；两端状态载体允许不同，但 `localogue_ui_language` / `localogue_metadata_language` 的语义不得漂移。
- 语言切换只改变 Presentation，不得写 Canonical，也不得为了显示另一种语言复制 Shared Entity。
- Work / Person / Organization 等可见名称必须尊重 Metadata Language；Facet / Query 仍按稳定 ID 与共享 `library-query` 语义运行。
- Canonical `screenshot` 类型继续保持 Schema 原值；用户界面将其显示为缩略图 / サムネイル / Thumbnail，不为文案改 Schema。
- Work Asset 展示顺序固定为 `poster -> fanart -> screenshot -> cover -> others`；poster/fanart/thumb 不允许再出现标签与图片顺序错位。
- Sidebar 折叠和语言偏好都是 Desktop 本机 Presentation Preference；不得进入 Canonical Library。
- Facet Rail 可以为可读性加宽、换行和响应式重排，但不得改变 WorkQuery / self-excluding Facet Count 的业务规则。
- V1-20 不修改已通过 Windows 实机验证的 V1-18 Hotfix 3 Native I/O / Unified Library 链；Governance Parity 进入 V1-23。


## V1-21 Vocabulary Governance 约束

- NFO / Connector 的混合分类禁止直接复制到 Canonical Genre / Tag。
- 新的来源词映射必须同步 `import-classification-normalizer.ts`、resources JSON/CSV 与 `docs/vocabulary/import-term-mappings.md`。
- 未知来源词保持 unmapped，不以“避免丢数据”为理由自动创建 Genre / Tag。
- Desktop 历史修复只自动处理 `genre_nfo_* / tag_nfo_*`，用户手工 Tag 不在自动修复范围。
- Work Detail 必须分开展示 Work Type / Genre / Tag 的用户可见名称，不显示混合内部 ID 列表。
- V1-18 Hotfix 3 Native I/O / Unified Library 扫描链继续冻结，除非有独立实机问题证据。


## V1-22 Information Architecture / Metadata Localization 约束

- Desktop 已有查询结果在筛选、分页或语言刷新时必须使用 stale-while-refresh；不得重新用矮 LoadingState 替换整块结果导致 WebView 滚动位置被夹回顶部。
- UI 主语言切换默认同时更新 Metadata Language；高级 Metadata Language 仍允许独立覆盖。语言变化只影响 Presentation，不得写 Canonical。
- Work Type、Person Activity Status 等受控枚举必须显示受控三语名称，不得直接向用户暴露 raw stable id。
- Genre 显示优先使用 Canonical 当前语言名称；缺失时只能通过 `genre-source-aliases` 中人工批准的来源别名回落。
- 完整外部 `genre.csv` 只作为一次性人工参考，不进入仓库；任何新增来源别名必须明确指向 `genres.*` 中存在的 Canonical Genre，并同步 `genre-source-aliases.*` / `import-term-mappings.*` / docs。
- Work Detail 的核心事实、人物关系、组织关系、Series、Work Type、题材和标签必须位于同一高密度主信息区；不得把分类信息再次拆到页面最底部的大卡片。
- Work Detail 顶部 Hero Gallery 不展示 poster；poster 用于作品墙/列表封面，Hero 优先 fanart / screenshot / gallery / cover。
- V1-18 Hotfix 3 Native I/O / Unified Library 稳定实现继续冻结；本阶段不得因 Presentation 修改扩大 Native 文件权限。
- V1-23 再继续 Evidence / Review / Commit Plan / Curation / History / Restore / Portable Pack 等完整治理链。


## V1-23 Desktop Governance 约束

- Desktop Review 必须复用共享 Evidence / Entity Resolution / Review Decision / Commit Plan Application Service，不得在 React 组件里重写第二套治理算法。
- Commit Plan fingerprint 必须在 Web 与 Tauri WebView 中确定性一致，不允许共享 Application Core 依赖 `node:crypto`。
- Canonical Commit 前必须由 Native Boundary 创建最小 before-image Snapshot；失败时优先自动 Restore。
- `evidence / evidence-lifecycle / review-commits / snapshots / restore-receipts / provenance` 等治理数据只允许写入当前 Desktop Settings 对应的 Private Library。
- Snapshot/Restore 的相对路径必须使用 Native 白名单；禁止 WebView 提供任意目标路径。
- Restore 不删除 Commit Receipt，必须追加 Restore Receipt / Provenance。
- Curation completeness / duplicate candidates 是派生信号，不写回 Canonical。
- `.localogue-pack` Personal Import 默认不覆盖既有文件；中途失败回滚本轮新建文件。
- Shared Portable Pack 必须先写临时目录、校验 manifest 与 id/version，再 rename 到正式安装目录；Shared Pack 仍然只读。
- V1-18 Hotfix 3 Native I/O / SHA-256 / Windows Walker 稳定实现不得因 Governance 功能而退化。

## V1-24 Presentation / Asset Governance 约束

- `PresentationPreference` 只表达当前用户“怎样显示”的私人偏好，不是 Canonical 事实；选择头像或封面不得改写 Person / Work 的公共元数据。
- Work 首图候选只允许与该 Work 有 Canonical 引用或 `subjectType=work / subjectId` 归属关系的 poster / cover；Person 头像候选同理只允许 portrait / gallery。
- Shared Pack 永远只读。Private Presentation Preference 可以指向合法 Shared Asset，但不得为了保存偏好复制或修改 Shared Entity。
- Desktop Presentation Preference 必须通过专用、最小 Native Command 写入当前 Settings 对应的 Private Library；禁止恢复成 WebView 可指定任意目录/集合的文件 API。
- 已失效的 preferred Asset 引用必须显式标记为 stale，并允许用户恢复默认；不得为了消除 stale 状态静默修改 Canonical 引用。
- 删除 Private Asset 前必须检查 Person / Work Canonical 引用以及 Presentation Preference 引用；仍被引用时必须阻止删除并要求用户先解除引用。
- V1-24B 若扩展 Shared Asset 二进制展示，应新增受控只读来源解析能力，不得扩大 `read_private_asset_bytes` 为任意本地文件读取器。
- Presentation / Asset 功能变化继续更新固定 `MANIFEST.md`、`PROJECT_STATUS.md` 与 `CHANGELOG.md`；禁止新建 `V*_MANIFEST.md`。
- 交付给用户的覆盖包继续只包含实际新增/修改文件；需要删除的旧文件直接在对话中列出或提供删除命令。



## V1-24 Dev Fixture 约束

- 依赖特定数据条件才能验收的新功能，优先同步维护 `examples/dev-library/` 可复现 Fixture，不得默认开发者本机一定有真实资料。
- `examples/dev-library/template/` 是 Git 中的只读测试真相；Desktop 手工测试应使用 `var/dev-fixture-library/` 运行副本，禁止直接修改模板来完成日常操作。
- Fixture 中禁止加入真实私人资料；人物、作品、图片、媒体与来源内容必须是可公开提交的虚构/生成式测试素材。
- Fixture Asset 必须保存真实 `storagePath / mimeType / fileSize / sha256`，并由 `pnpm validate:fixture` 校验二进制存在、签名与 Hash。
- 新增测试场景时应把稳定 Entity / Asset ID 写入 `examples/dev-library/fixture-manifest.json`，后续 E2E 不依赖列表顺序或界面文案寻找测试对象。
- `desktop:demo:*` 脚本不得自动改 `.localogue/settings.json` 或真实 Private Library 路径；测试工具只能准备数据，实例切换必须由用户显式完成。
- `var/` 只放可重建运行数据并保持 Git 忽略。
- Canonical Work / Person 结构示例统一复用 `examples/dev-library/template/works` 与 `template/people`；不要重新创建顶层 `examples/works` / `examples/people`，避免两份 Schema 示例漂移。
- `examples/imports / settings / shared-packs` 应尽量与 Dev Fixture 使用同一套稳定 ID 与虚构测试世界；能联动复现的场景不要再新造一套孤立 Demo。
- `sample-existing-work.json` 必须持续命中 Fixture 中真实存在的 Work，并保留至少一个明确字段差异；`validate:fixture` 负责守住这一契约。
- Starter Shared Pack 应保留至少一个与 Private Fixture 同稳定 ID、但显示值故意不同的记录，用于肉眼与自动化验证 `Private > Shared`。

## V1-24 Foundation Cleanup / Library Profile 约束

- Desktop 必须允许多个独立 Library Profile 快速切换，用于示例库与用户自建资料库不同收藏；不得要求用户为每个库安装一个新的 Localogue 实例。
- 一个 Library Profile 只保存本机资料源路径：`libraryPath / libraryRoots / mediaScanPaths / nfoScanPaths / sharedPackPaths`。切换 Profile 不得复制、移动、合并或删除任何 Canonical / Media 数据。
- Profile 新建、切换、重命名和删除必须立即持久化，不能只改 React 临时状态；`activeLibraryProfileId` 失效时必须回退到现有 Profile，而不是清空列表或重新迁移出“幽灵资料库”。
- “添加示例库”属于产品能力：Desktop 必须从内置 Fixture 资源自动创建 App Local Data 可写副本；普通用户不得被要求运行 `pnpm desktop:demo:reset`。该命令只服务仓库开发/验收。
- `ffprobePath / webUrl` 等运行环境设置是应用级全局配置，不得因为增加 Profile 而在每个资料库重复保存。
- Settings 普通用户语义固定为四层：私人资料库（可写）、内容根目录（推荐）、只读共享资料、高级兼容目录；`mediaScanPaths / nfoScanPaths` 必须继续作为高级兼容能力，不重新提升为主路径概念。
- Unified Library 一键同步必须在 NFO → Asset 之后等待**全部**有效 Media Root 扫描完成才可显示“同步完成”；多根目录不得因第一个 root 完成就提前刷新为成功。
- 媒体扫描结果必须可观察本轮实际 roots，便于多目录配置排错；手工扫描继续保留 Job / Progress / Cancel。
- Desktop bundle 变大时优先真实 code splitting / lazy loading；禁止仅通过调高 `chunkSizeWarningLimit` 消除告警。
- Dev Fixture 长期至少维持 10 个 Work、6 个 Person，并同时覆盖有图与无图、关系筛选、Presentation、Import/Review 场景；生成式图片继续作为可公开提交的视觉测试资产。
- `localogue-community-data` 与主程序保持独立仓库：前者维护可共享事实数据，后者维护代码、Schema、词表与虚构 Fixture。Localogue 通过 Shared Pack / 未来 Registry 消费社区资料，不在主仓库复制第二份真实元数据。

