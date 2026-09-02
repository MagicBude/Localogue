# Localogue AI / Agent 协作说明

本文件用于约束后续参与 Localogue 的 AI、Agent 和开发者。任何实现方案在修改代码或数据结构前，都应先阅读本文件及 `docs/README.md`。

## 一、当前阶段

当前阶段：**V1-11 File-backed Library / MediaFile Binding 与 Portable Pack**。

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
- 修改 Desktop Runtime 边界后必须运行 `pnpm validate:desktop`；有 Rust/Tauri 环境时另外运行 `pnpm desktop:doctor` 与 `pnpm desktop:dev`。


### V1-13 Desktop Open 边界

- `open_web_url` 使用 URL Parser 校验，当前只允许 `http://localhost` 与 `http://127.0.0.1`，不能只依赖字符串前缀。
- `open_path` 当前只允许 Localogue 支持的视频扩展名，避免 Webview 将“默认程序打开”能力扩大成打开 `.exe` / 脚本等任意可执行目标。
- `reveal_in_folder` 只负责在系统文件管理器中定位已经存在的路径，不执行目标。
- 通用 Shell execute/spawn 仍不向 Webview 暴露。
