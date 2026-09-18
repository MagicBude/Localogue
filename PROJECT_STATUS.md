# Localogue 项目状态

## 当前阶段

**0.2 Desktop Beta Readiness。** V2 SQLite 存储迁移已经技术收口，当前重心从内部阶段编号转为普通用户可感知的完整流程：首次选择目录、可观察同步、异常处理、资料浏览与编辑、委托播放、备份恢复和 Windows 发行验收。

2026-09-18 根据真实 NFO 警告补齐 6 个可解释中文精确 Alias、1 个促销 Source-only Alias，并将 3 个复合/多义词从普通 unmapped 分离为 review-required；媒体人工绑定由页面末尾内联面板改为宽对话框。等待真实 NFO 重扫与绑定窗口实机验收。

2026-09-18 Desktop 扫描任务改为跨页面常驻，普通导航不再卸载 MediaScanCoordinator、进度轮询与扫描历史记录；返回目录页可查看原任务状态。设置页数据存储位置增加受限“打开文件夹”入口。自动检查通过，等待 Windows 实机验收切页期间持续扫描和资源管理器打开行为。

2026-09-18 新建影片库流程补齐首个内容目录选择：新资料库不再生成需要用户回头补配置的空壳，选择目录后直接进入已有统一扫描；历史空资料库在设置页提供补选目录并扫描入口。普通追加目录与既有单独/全部扫描语义保持不变，等待 Windows 实机验收。

2026-09-18 Desktop 资料库与扫描入口完成信息架构收敛：影片库设置直接展示内容目录、扫描范围和“扫描全部目录”；扫描任务页保留实时进度、历史和高级排查；关于页统一承载运行环境、日志和诊断，移除未内置 Web 服务的浏览器入口。等待 Windows 实机确认首次建库和目录切换流程。

2026-09-18 Desktop 浏览体验补齐返回状态：作品和人物详情返回会恢复筛选、页码、每页数量及滚动位置；资料库设置的内容目录操作区固定右对齐，设置分类标签在滚动时吸顶。等待 Windows 实机确认多层作品/人物跳转返回。

2026-09-18 作品与人物列表详情改为覆盖式详情窗口：列表保持挂载，关闭窗口不改变原浏览轨迹；作品与人物关联跳转可逐层关闭。等待 Windows 实机确认详情编辑、删除和多层关闭行为。

2026-09-18 修复人物列表滚动恢复 Hook 顺序导致的点击白屏，并接入 Tauri 原生顶栏双击放大/还原。等待 Windows 实机确认人物打开和窗口双击操作。

2026-09-18 无边框标题栏改用 Tauri 官方 drag region，去除 React 手写拖动对双击行为的干扰；已有 UiActionDialog、UiButton、Radix Dialog 和 Fluent UI 图标继续作为共用组件，后续新增交互优先复用。

2026-09-18 Desktop 二级页签与筛选浮窗复用 UiButton 基础组件，统一 loading、disabled、焦点和按钮语义；平台窗口控制仍保留专用控件样式，避免与通用业务按钮混用。等待 Windows 实机确认筛选浮窗和页签视觉无回归。

2026-09-18 扫描主链进入适度性能与可观察性收口：NFO 文本读取/XML 解析采用固定 6 路并发，目录发现、NFO 解析/保存、图片保存和视频分析复用目录卡片实时进度；同番号多媒体继续作为 Work → MediaFile 一对多正常状态。媒体绑定候选支持在弹窗内展开 Work 文字资料，不跳转完整详情。等待大目录实机验收吞吐和进度刷新。

2026-09-18 扫描主链正确性检查发现并修复无空格文件名误识别：日期紧贴番号时先遮蔽日期再解析番号，`2025-01-31SAME-151标题` 可稳定得到 `SAME-151`；保留“破解”等版本标签的人工留意状态。下一阶段转向 NFO 批量解析、匹配性能和分阶段进度。

2026-09-17 统一作品、人物与分类浏览的筛选浮窗：桌面端按锚点方向展开，窄窗口使用右侧抽屉，分类页的使用情况和题材分组不再作为内容内悬浮条；人物状态、年份和罩杯补充 self-excluding 可用数量。自动检查通过，等待用户实机验收。

2026-09-16 人物浏览筛选与作品页统一：人物页改为顶部常用筛选、更多条件弹层、已选条件 Chips 和结果行分页；移除整块高级表单对首屏人物卡片的遮挡。同步修复 Desktop Webview 构建中的重复翻译键和媒体目录可选路径类型错误，等待用户实机验收。

2026-09-16 开始媒体优先密度收敛：压缩 Desktop 顶部壳层、作品/人物页面身份区、筛选工具栏和卡片间距，让首屏可用空间优先留给图片与结果；查询和操作语义不变，等待用户实机验收。

2026-09-16 参考 115-Desktop 完成浏览框架第三轮：Tauri 改用自绘无边框标题栏，搜索、语言与窗口控制固定在窗口框上；作品/人物页码、跳页和每页数量改为窗口底部固定底栏，结果区预留安全空间，瀑布流保留连续加载。等待用户实机验收窗口级布局。
2026-09-16 修复自绘窗口实机问题：补齐 Tauri 最小化、最大化、关闭与拖动权限；搜索框缩窄并按整个窗口绝对居中；筛选栏紧贴标题栏吸顶；单页底栏隐藏左侧翻页区，仅保留右侧每页数量。自动检查和最大化按钮调用通过，等待用户继续实机验收。
2026-09-16 根据 115-Desktop 对照截图重构影片库空间骨架：筛选工具区退出悬浮覆盖，作品/人物结果进入独立滚动框，分页成为仅属于结果框的固定布局底栏；侧栏、内容和底栏不再互相侵入，海报网格同步降低列密度。自动检查通过，等待用户实机验收视觉与滚动手感。
2026-09-16 继续统一影片库三类浏览页面：移除作品/人物占高的说明页头，将新建 Work/Person 收入共用筛选工具栏并统一弹窗；人物页改用与作品页相同的 Library Layout；分类浏览改为固定搜索工具区和独立内容滚动区，题材导航从滚动区顶端吸附。等待用户实机验收。
2026-09-16 修复人物页统一布局后的旧样式残留：移除人物筛选的 sticky 顶部偏移，消除分类标签下方整行空白；将过早触发的双行响应式阈值降至窄窗口，并视觉隐藏字段标题，使常用桌面宽度下筛选保持单行。等待用户实机验收。
2026-09-16 修复人物搜索框在紧凑工具栏中缺少可见说明的问题：输入框补充“搜索姓名 / 别名 / 旧艺名”占位文字和 aria-label，搜索范围继续覆盖 Person.names 全部姓名类型。等待用户实机验收。
2026-09-16 参考 115-Desktop 将窗口搜索改为页面上下文能力：作品、人物、分类浏览和收藏分别显示对应搜索并驱动各自查询，人物与分类正文移除重复搜索框；首页、详情、目录扫描、治理、设置与关于等无明确搜索对象的页面隐藏搜索。自动检查通过，等待用户实机验收。
2026-09-17 参考 115-Desktop 收敛 Desktop 主导航：默认启用新版 68px 紧凑侧栏，将作品、人物、分类浏览、目录与扫描提升为直接任务入口，移除内容顶部重复的影片库四标签；资料维护和设置仍在进入任务后使用二级标签。已完成实机截图检查，等待用户验收交互。

2026-09-17 继续统一日常浏览工作区：作品、人物与分类页明确拆分为工具条、唯一结果框和结果底栏；分类分组退出多卡片叠层，改为同一滚动框内的分隔区，并将题材维度条固定在内容框顶端。三类页面的加载、错误与无结果状态复用统一组件；自动检查和 Windows 实机逐页检查通过，等待用户验收视觉与滚动手感。

2026-09-17 对齐 115-Desktop 的分页与筛选逻辑：作品和人物底栏固定为左侧总数、按需分页、右侧每页数量；单页不再显示无意义页码。两页共用一个筛选按钮和锚点浮窗，排序与视图保持常驻，浮窗开合不改变结果区尺寸。自动检查和 Windows 多页/单页实机检查通过，等待用户验收。

2026-09-17 完善人物筛选与详情首屏：共享 PersonQuery 新增出生地、罩杯和五项资料有无条件，可直接定位缺图片、缺生日、缺身高、缺三围或缺简介的人物；人物编辑改为首屏按钮和独立对话框，核心事实并入人物头部。自动检查与 Windows 筛选实机验证通过，等待用户验收。

2026-09-14 Settings V2 完成破冗余收口：每个内容目录只保存一次，并分别声明是否扫描视频、NFO 和图片；路径只属于当前 `libraryProfiles[]`，全局旧路径字段不再写回。Native 读取旧设置时只做一次内存迁移，下一次保存即输出纯 V2；旧 EXE 不再作为兼容目标。等待多目录隔离环境实机验收。

2026-09-14 明确 Portable Pack 产品边界：个人备份用于迁移私人资料和恢复，不包含原始视频；社区资料包用于分发只读公共元数据。Portable Pack 不承担视频共享、云盘同步或跨设备播放，详细决策见 ADR-051。

2026-09-14 明确 SQLite 运行时边界：Desktop 正常读取以 `local.db / catalog.db` 为主，数据库覆盖的数据根不再重复遍历 JSON；JSON 保留为迁移、交换、备份、恢复和故障回退格式。SQLite 与 JSON 的物理层不再被误认为两套产品真相，详细决策见 ADR-052。

2026-09-14 开始统一审计事件节点：现有 Evidence、Commit、Restore、Provenance、人物编辑、媒体绑定、扫描和 Asset 删除 Receipt 暂不合并或删除；先建立跨 JSON / SQLite 的只读 Audit Event 视图，再评估是否建立可重建的 SQLite 投影表。详细边界见 ADR-053。

2026-09-14 完成第一轮用户术语治理：普通界面统一使用“影片库、内容目录、社区资料、待审核资料、个人备份”，不再要求用户理解 Library Profile、Private Library、Shared Pack、Canonical、Evidence 或 Commit Plan。内部 Domain / Schema 稳定名称保持不变；完整定义与可合并项见 `docs/product/user-terminology.md`。日英翻译已同步，等待用户实机验收。

2026-09-14 首次使用流程完成第一处收敛：选择内容目录并创建受控私人资料库后，Desktop 直接进入“导入与整理”并触发已有 Unified Sync，不再返回首页要求用户再次点击“一键同步”。NFO → 图片 → Media 编排、进度和取消仍复用同一 Application / Platform 边界，等待全新 Profile 的 Windows 实机验收。

2026-09-14 目录任务反馈参考 JavBoss 完成第一轮增强：每个内容目录卡片显示空闲、扫描中、完成、取消或失败状态，并保留上次扫描时间、耗时、新增、更新、关联与未关联统计；单目录同步只标记对应目录。状态继续由 Unified Sync 与 Media Scan Receipt 派生，没有新增第二套目录数据库。

2026-09-14 统一同步补齐完成后的任务出口：用户可在同步卡片直接查看作品库；存在未关联媒体时可在同一“导入与整理”工作台平滑定位到媒体处理区，减少同步后再次寻找入口。

2026-09-14 扫描术语完成面向用户的收敛：主操作统一称“扫描资料库”，明确同时处理 NFO、图片和视频；只更新视频文件与技术参数的独立 Media Scan 默认折叠为高级操作。内部 Unified Sync / MediaScanCoordinator 分层保持不变。

Localogue Desktop 是正式产品入口；Next.js Web 暂时作为历史能力宿主与开发验证入口。ADR-047 提议在能力迁移后退役 Web，ADR-048 提议通过受控子进程 Adapter 补齐元数据获取。两项均处于提议状态，不代表已经实现。

2026-09-14 V2 Storage Migration 完成技术收口：Evidence / Curated Catalog / Personal Library 三层、只读 `catalog.db`、可写 `local.db`、原子迁移、零差异门控、双写补偿、SQLite → JSON 回导和 Shared Portable 发布链均已有实现与验证。Community Catalog 数据库对账通过；当前开发 Profile 对账为实体 200、媒体 173、偏好 1、Evidence 0、审计 5，并成功回导 379 个 JSON。Web 的保留或退役作为后续独立产品决策，不改变 Desktop 存储结论；用户界面行为仍待实机验收。

2026-09-14 V2 Storage Migration 第九节点停止数据库化数据根的重复 JSON 遍历：Native SQLite Reader 返回当前集合实际覆盖的 Private / Shared `library` 根，Desktop Repository 只为缺少数据库的旧 Shared Pack 调用 JSON Adapter。多 Pack 的 Private > Shared 1 > Shared 2 优先级不变，JSON 继续承担交换、审核、回滚与旧包兼容职责。

2026-09-14 V2 Storage Migration 第八节点完成 Desktop 私人运行时读取切换：Presentation Preference、Evidence 与 Governance 审计集合和 Canonical / MediaFile 一样，只在当前 Profile 的 JSON / `local.db` 零差异门控通过后读取 SQLite；不满足门控时继续读取 JSON。Native IPC 显式传递 `preferSqlite`，Contract revision 提升到 14，避免 WebView 与 Rust 参数漂移。

2026-09-11 V2 Storage Migration 第七节点完成公共 Catalog 发布边界：Shared Pack 可同时携带 `catalog.db`、可审核 JSON 与 Sources；Portable 导出将数据库作为二进制，Native 安装进行摘要、SQLite 完整性、Schema 和 Pack 身份校验后原子启用。官方 Community Data 已用可重复脚本生成 827392 字节发布投影并通过数据库对账；其仓库中的发布文件需独立提交。旧 Shared Pack 继续使用只读 JSON，等待用户实机导出/安装验收。

2026-09-11 V2 Storage Migration 第六节点完成 Profile 自动迁移与读取门控：Desktop 启动或切换资料库时，在当前 Private Library 缺少数据库的情况下通过临时文件构建 `local.db`，合并 WAL 后原子发布，并以 JSON/SQLite ID 与内容零差异作为启用条件。Canonical 浏览与 MediaFile 读取可使用 SQLite；失败或差异状态继续使用 JSON。Shared Pack 暂时保留 JSON 回退，下一节点完成只读 `catalog.db` 的发布包交付与安装校验。

2026-09-11 V2 Storage Migration 第五节点完成 Desktop 私人数据双写和可见对账：现有 Native 写入口在 Private 根存在 `local.db` 时同步更新数据库，镜像失败恢复 JSON before-image；Personal Pack 与 Governance Restore 同样进入该链。设置 → 工具可查看 JSON/SQLite 总数、缺失和内容差异。Rust 7 项测试覆盖读取、双写、失败补偿与差异检测；下一节点自动 provision/migrate 每个 Profile 的 local.db，并以差异为零作为 SQLite 读取门槛。

2026-09-11 V2 Storage Migration 第四节点建立 Desktop SQLite 只读 Native Adapter：Rust 使用 bundled SQLite，只允许从当前配置推导数据库并以只读方式打开；WebView 不能提供任意路径。Catalog Work/Genre JSON payload 已标准化，Rust 单元测试覆盖 Catalog、Private 与 Media 三类读取。该 Bridge 尚未替换现有 JSON Repository，下一节点先实现双写和双读差异报告。

2026-09-11 V2 Storage Migration 第三节点完成 Web 侧 SQLite Repository 与 Contract：`LOCALOGUE_STORAGE=sqlite` 可显式切换 `catalog.db + local.db`，页面仍只依赖 `LibraryRepository`，过滤/Facet 继续复用 `queryWorks/queryPeople`。Contract 已在数据库副本验证 5 个 Works、13 个 People、番号规范化和 Private Override；默认仍为 JSON，下一节点实现 Desktop Native SQLite Adapter 与真实应用双读对账。

2026-09-11 根据实机反馈修正作品展示语义：原 `海报墙` 恢复为 `poster` 竖版海报，JavBoss 式 `fanart` 卡片作为新增的独立 `封面墙`；fanart 使用自然比例，不强制统一画框，因此不裁图也不补黑边。视图切换扩展为海报墙 / 封面墙 / 瀑布流 / 列表 / 表格五项，等待用户实机验收。

2026-09-11 V2 Storage Migration 第二节点建立 `local.db`：迁移器只读现有 Private Library JSON，以临时数据库和 Migration Receipt 完成复制；可重新导出一实体一 JSON。当前开发库已对账 2 个 Presentation Preference 与 2 个 Evidence，原文件保持不变。下一节点开始 Repository Contract 与 Desktop Native SQLite Adapter。

2026-09-11 启动 V2 Storage Migration。第一节点建立 ADR-046、`catalog.db` Schema 和 Community JSON → SQLite 原子构建/对账工具；公共 Catalog 与私人 Library 将分别进入只读 `catalog.db` 和可写 `local.db`。当前运行时仍读 JSON，待 SQLite Repository 查询对账后再切换，避免一次性替换造成数据风险。

2026-09-11 用户确认 JavBus 分类分流原则后，已用 OpenCC 香港繁体转简体执行第一批保守精确归并：60 个来源词唯一命中既有 Genre / Work Type / Source-only，未新建 Canonical Genre。当前为 239 Genre / 16 Work Type / 11 Source-only / 12 Review / 1 Ambiguous / 528 Unmapped；541 项审核 CSV 继续保留来源证据和人工结论列。

2026-09-11 Desktop 新增独立的 JavBoss 式封面墙：它优先完整显示 `fanart`，缺失时再回退 `cover` / `poster`，并限制标题/人物/分类行数；原海报墙与瀑布流继续使用 `poster`。当前开发资料库实测 46 个 Work、0 个 Asset，因此现有番号占位图属于没有封面数据，不是图片组件渲染失败；需要通过本地图片同步、手工图片导入、来源封面接入或显式视频抽帧补齐。界面布局等待用户实机验收。

2026-09-11 Desktop 作品发现入口继续简化：收藏成为左侧一级入口，并从资料库顶部分类和“更多筛选”移除重复入口；常用筛选只呈现目录、人物、作品类型、题材、标签、年份、时长、评分、本地媒体和清晰度。厂商、厂牌、系列、精确日期与封面状态仍保留在 `WorkQuery`，供分类浏览、详情反向导航和既有查询状态使用。当前等待用户实机验收入口是否更直观、筛选菜单是否足够轻量。

2026-09-11 Desktop 页面身份区按用户截图统一压缩：PageTitle / GovernanceTitle 移除英文阶段口号，标题和说明使用紧凑层级；作品库标题与新建按钮同排，首页 Hero 改为横向欢迎条并移除 V1 实现说明。功能入口保持不变，当前等待用户实机验收各页面首屏密度。

2026-09-11 Desktop 作品筛选完成正式收敛：参考 Plex 的工具栏快速筛选、Lightroom 的分组展开以及本地 JavBoss 的锚点菜单与条件 Chips，将目录、人物、分类、更多拆为四个独立 320px 菜单，一次只展开一组。已选条件保持单行横向滚动；上一节点的可拖动汇总侧板作为过渡实现已退出主流程。当前等待用户实机验收。

2026-09-11 Desktop 作品筛选侧板增加窗口内拖动：用户可抓住标题区移开被遮挡的作品，拖动坐标会限制在当前窗口内。该节点按用户要求独立提交；完全无覆盖的筛选交互仍需继续研究和评估。

2026-09-11 根据第一版实机截图重新设计作品库：高级筛选不再使用 820px 横向大浮层，改为窗口右侧 410px 单列侧板，固定标题和底部操作，仅中间条件滚动；常驻“新建作品”大卡片也已压缩为按钮和弹窗。当前实机已确认侧板不再产生半屏空白、首屏作品出现位置明显提前，细节继续等待用户验收。

2026-09-11 参考本地 JavBoss 的首屏编辑入口和临时筛选交互，Desktop 作品编辑已移到详情首屏操作区并改为宽弹窗分组表单；作品库常驻筛选区压缩为单行，高级条件改为覆盖式浮层，避免筛选展开后把作品推到半屏以下。查询仍复用 `WorkQuery`，编辑仍复用 Private Override 与 Native 写入边界。当前等待用户实机验收编辑效率、浮层尺寸和小窗口适配。

2026-09-11 Desktop 原生确认框已经收敛：应用级 `UiConfirmProvider` 统一承载 Work、Person、Asset、资源清理、分类修复、Review Commit 和 History Restore 的确认交互；取消不会进入原操作，确认后继续既有 Application / Native 安全链。自动检查完成后仍需在隔离测试库验收，不使用真实资料测试删除或恢复。

2026-09-11 Desktop 长页面导航按 JavBoss 的常驻操作原则和首轮实机反馈完成收敛：Work / Person 详情只保留右下角悬浮返回，作品与人物分页只保留吸顶入口。顶部应用框架移除重复设置和手动刷新，改为居中作品搜索与紧凑语言菜单。当前等待用户实机验收滚动、分页、搜索和逐级返回手感。

2026-09-11 Desktop 编辑写入安全继续收口：人物编辑已具备与作品一致的取消草稿入口；人物与作品表单保存时完整锁定并防止重复提交；Presentation Preference 的收藏、评分和首图更新改为按资料库串行合并最新字段。自动检查通过，实际写入行为等待隔离测试库与用户验收。

2026-09-11 继续执行 Desktop 全流程审核台账：作品库访问详情前会保存筛选、分页或瀑布流已加载批次、视图与滚动位置，返回时重新查询当前 Repository 并恢复浏览现场。该节点已通过自动检查，等待用户桌面操作验收。

2026-09-11 按用户要求收口换机交接：本轮任务暂停，完整后续优先级和换机提示词见 `docs/development/localogue-handoff.md`。本轮未重建 release EXE/安装包，未执行真实资料删除或恢复验收。

本轮逐节点审核记录见 `docs/development/desktop-ux-audit.md`：首页分类导航、异常详情返回、人物别名搜索、作品取消草稿、消息淡出与导航列表状态恢复已补齐；标签分类持久化和完整 JavBus 三语来源库仍未完成。状态继续为等待用户验收。

2026-09-11 全流程审核进行中：已修复详情草稿跨实体复用、标签并发写入和重复归属读取；关于页新增离线中日英教程与手动更新说明，长对话框适配小窗口。在线检查更新尚未实现，未宣称程序已是最新。整体状态为等待用户验收，后续继续审核导航状态恢复、编辑取消及标签分类持久化。

**V1-27D：Entity Localization & Browse Relationship Presentation。**

Desktop UI 基础层开始渐进统一：第一批新增按钮、输入/选择、状态反馈和空状态 Primitive，并迁移关于页、日志弹窗与设置关键入口；第二批覆盖全局状态、首页和媒体诊断反馈。后续页面按实际维护触达逐步复用，不进行一次性全量 JSX 重写；Fluent Icons / Radix 继续只承担图标与无样式交互，视觉主题仍由 Localogue CSS 维护。

资料库 Profile 的重命名与删除已收敛为应用内统一对话框：删除默认只移除配置，受管 Private Library 必须额外勾选才会删除，内容根目录不进入删除范围。该调整简化了原先连续两次系统确认框，同时继续保持默认文件操作非破坏性。

Desktop 普通设置已统一为自动保存：选择路径立即保存，文本字段在离开输入框时保存，不再保留一颗容易遗漏的全局保存按钮。全局消息改为右上角浮层 Toast，不参与正文布局；成功提示会在 4.5 秒后淡出，错误与警告保持可见并允许手动关闭。资料库移除界面按 Native-managed / 用户自选路径分别解释可删除范围，避免把用户目录或应用级日志误称为可随资料库清理的缓存。

Desktop 产品流程优化已经从信息架构开始：原有十一项平铺菜单收敛为首页、资料库、导入与整理、资料维护、设置五个一级任务区，领域浏览与治理页面作为二级入口按需展开。“导入与整理”已经合并为单页连续工作台，统一目录同步、媒体扫描、NFO / 图片导入和 Evidence 核对可以从上到下完成；现有 Repository、Query、Evidence Review、Media Scan 与 Native 安全边界保持不变。桌面已实际启动并检查完整页面布局，仍待用户操作验收。

多目录体验开始向 JavBoss 的 Directory Scope 靠拢：设置目录即时保存，工作台持续展示全部已添加目录并支持逐目录增量同步，作品页可按一个或多个 `MediaFile.scanRoot` 查看内容；设置页面按任务模块切换，统一同步显示可持续观察的阶段状态。当前目录筛选只覆盖已经扫描且成功关联 Work 的本地媒体，目录自定义名称、启停和离线状态留待下一阶段完善。

Desktop 维护线开始页面模块化：Home、Works、People 及其详情已从应用入口拆出；首页最近作品扩展为 12 条并增加“查看全部作品”，同时消除一次重复 Works 全量读取。Media、Packs、Settings 将按 Native/Application 能力边界继续拆分。

当前维护修正已统一文档、Community Catalog 审计口径与作品画廊行为：`registry:audit` 默认审计社区目录；作品详情画廊可完整浏览 poster / cover / gallery / fanart / screenshot，并按图片真实比例适配，不再固定为横版舞台。

Desktop 发布基线现已启用 NSIS current-user 安装器；`pnpm desktop:build` 会先校验四处版本、图标、内置资源和 ffprobe Sidecar 边界。本机已实际生成 `Localogue_0.1.25_x64-setup.exe`。该产物适合本机与小范围验收；公开发行仍需代码签名、干净 Windows 环境测试和更新渠道。

新建 Library Profile 现在自动分配独立 Native-managed Private Library，普通用户只需要选择内容根目录；NFO 导入结果区修复表格负边距造成的轻微重叠，并明确未映射来源词属于当次导入提示而不是应用日志。

作品浏览器筛选 / 排序规则链现已接入收藏与评分：在 `WorkQuery` 增加 `favoriteOnly` / `ratingMin` 筛选与 `rating_desc` / `rating_asc` 排序，收藏与评分数据按需从私人展示偏好层注入查询核心，并完整覆盖筛选器、活跃 Chips 与 URL 深链；未配置收藏 / 评分时所有新维度自动退化为“不过滤”，不增加纯浏览请求的开销。

收藏按钮现已覆盖作品浏览器的列表（list）与表格（table）视图：新增 `FavoriteButton` 的 `inline` 紧凑形态，与卡片 / 详情 / 收藏页共用同一 `FavoritesProvider` 乐观更新，grid / waterfall / list / table 四种视图均可一键收藏。

收藏页（`/favorites`）新增按评分 / 发行日排序，排序结果通过 URL `sort` 参数深链；评分排序复用同一私人展示偏好层，不修改 Canonical Work。

网页端现已采用与桌面端一致的 Library Profile 多资料库模型：设置页支持切换 / 重命名 / 删除 / 新建 Profile，顶栏提供仅多 Profile 时出现的切换下拉，并补齐桌面端独有的「添加示例库」能力；旧版单组路径在读取时自动升级为 Profile，扁平字段始终镜像当前 Profile。Web / Desktop 在资料库层对齐，详见 `docs/product/library-profiles-web.md`。

作品收藏与个人评分（1–5 星）已落地：复用官方 `PresentationPreference` 私人展示偏好层，不污染 Canonical Work、不进 Shared Pack；未配置 Private Library 时回退 `data/library` 仍可本地保存。卡片心形按钮、侧栏带徽标的「收藏」入口、`/favorites` 收藏页与详情页五星评分均已接入，详见 `docs/product/favorites-and-ratings.md`。

本地视频抽帧生成封面已落地：作品详情页可一键从首个可读取的本地视频截帧，作为私人封面偏好（不修改 Canonical Work、不进 Shared Pack）；设置页新增 `ffmpegPath`，未安装 / 未配置 ffmpeg 时返回结构化降级原因而非报错。抽帧走 `MediaFramePort` + `NodeFrameAdapter`，沿用 ffprobe 的平台边界；详见 `docs/product/cover-frame-extraction.md`。



V1-27D 在不增加 Browse 级联筛选的前提下继续完善目录可读性：

- Community Catalog 名称增加 `nameKinds`，明确来源原名 / 审核品牌写法 / 社区翻译 / 社区转写；
- Maker / Label / Series 逐步补多语言显示，缺少可靠中文品牌名时允许回退原名；
- Label / Series 卡片展示已确认的父级 Maker / Label，关系无证据时不猜；
- Browse 继续只负责“看全部目录”，Maker + Label + Series + Genre 等组合筛选统一留给 Works 多维筛选；
- 当前 Community Organization 多语言覆盖：zh-CN 6 / 35、en 34 / 35；Series：zh-CN 7 / 9、en 8 / 9。

V1-27B 已进入有限目录的真实 Provider 覆盖：

- Registry Provider capability 从 4 扩展到 8，加入 S1 / IDEAPOCKET / MOODYZ / Madonna 官方站独立 namespace；
- Organization Evidence 58 条，Series Evidence 9 条；累计 45 个 verified Provider ID + 22 条 name-only Evidence；
- FANZA 当前静态切片包含 22 Maker ID、12 Label ID，并保留 2 条 Label name-only 真实作品样本；本仓库不负责在线采集。
- Maker 官方站当前收录 9 个可公开复核的 Series ID；这些 ID 不与 FANZA/JAVBus/JAVDB 混用；
- 新增 `registry:coverage`；

V1-27C 开始把“来源证据”晋升为真正可浏览的 Canonical Community Catalog：

- 新增 `resources/catalogs/community-organizations.{json,csv}` 与 `community-series.{json,csv}`；
- 首批 Community Catalog：22 Maker / 13 Label / 9 Series，共 44 个 Canonical Entity；
- 54 / 67 条 Registry Evidence 已通过 `canonicalId` 映射到 Community Catalog；未充分确认的 name-only Evidence 继续留在 Registry，不强行合并；
- 新增 `validate:catalog`，要求 Catalog 实体至少拥有一条 verified Evidence，并校验 JSON/CSV、kind、parent 与 canonicalId 反向映射；
- Desktop Browse 的“有作品”继续只看当前 Library Profile 的真实 Work 关系；“无作品 / 全部”额外显示 Community Catalog 中尚未被当前资料库使用的 Maker / Label / Series；
- Genre 分面按钮与下方题材卡片增加垂直间距，改善层级拥挤；
- Community Catalog 是全局只读参考索引，不修改 Library Profile，也不会自动挂载/复制成 Shared Pack。

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

### V1-28 Explainable Media Recognition

- MediaFile 新增可重算 `recognition` 快照；
- 支持普通单文件、CD/Part 1/2/10、常见版本与辅助媒体线索；
- Unified Sync 比较文件名和同 stem NFO 番号，冲突停止自动绑定；
- 损坏 NFO 继续由 NFO Preview 报错，未知视频继续作为未识别 MediaFile 保留；
- 新增匿名字符串验收脚本，不读取用户真实资料。

### V1-28 JavBus Genre Provider Evidence

- 完整保存 888 条 JavBus Genre 来源记录、839 个名称/页面分类组合与 807 个唯一名称；
- 保存原文、来源分区、页面分类、Provider ID、URL、采集时间与响应/提取摘要；
- 新增显式联网刷新、离线路由重算和来源证据校验命令；
- 用户确认分流原则后的当前路由为 239 Genre / 16 Work Type / 11 Source-only / 12 Review / 1 Ambiguous / 528 Unmapped；
- `censored:hd` 来源 ID 冲突保持待审，不覆盖 Canonical。

## 下一阶段建议

**下一阶段建议：0.2 Desktop 日常闭环与发行验收。**

1. 使用隔离资料库完成首次启动、多目录、单目录增量扫描和取消的实机验收；
2. 解决 `docs/development/desktop-ux-audit.md` 中阻断浏览、编辑、备份和恢复的项目；
3. 在干净 Windows 环境验证安装、升级、卸载、日志定位与错误恢复；
4. 对 ADR-047 的 Web 能力迁移清单和 ADR-048 的首个元数据 Adapter 作正式决策；
5. Community Catalog 与多语言覆盖继续维护，但不再替代核心用户流程的交付。

## 当前不做

- 未接受 ADR-048 前的在线爬虫与 Provider 实现；
- 通用视频模式、CloudDrive2、磁力下载和浏览器下载扩展；
- AI Agent；
- 内嵌视频播放器、视频转码和串流；
- 自动搬移、重命名或删除用户媒体文件；
- Desktop 与 Web 设置的隐式双向同步；
- 未经过许可、版本与校验流程的第三方二进制自动打包。

### V1-13 Webview Build Target 补充

Desktop 独立 Vite Check 已支持 Host Platform fallback：在非 Tauri CLI 场景下根据 Node `process.platform` 选择目标。Windows 使用 `chrome105`；WebKit 使用 `safari14.1`。这避免 Windows `pnpm check` 因缺少 `TAURI_ENV_PLATFORM` 而错误构建 Safari 13 bundle。


### V1-13 Desktop 构建配置确定性

Desktop Vite 配置现在以 `apps/desktop/vite.config.mts` 为唯一正式来源，所有 Vite 命令显式使用 `--config`。根 `pnpm check` 会先执行 `desktop:clean:legacy`，清理早期版本曾由 `tsc -b` 误生成的 `vite.config.js/.d.ts` 与旧 `vite.config.ts`。这解决了 ZIP 覆盖升级不会删除历史文件、导致 Validator 读取新配置而 Vite 实际执行旧配置的问题。

- V1-13 Desktop 开发服务器已按 Tauri 推荐配置忽略 `src-tauri/**`，避免 Windows Cargo/MSVC 产物与 Vite watcher 竞争导致 EBUSY。
### V1-18 实机 Hotfix 2

- Windows 扫描根不再依赖 `fs::canonicalize`，兼容可 `read_dir` 但 canonical final path 返回 OS 1005 的卷。
- 迭代扫描、junction/reparse 目录防环和后台 worker 继续保留。

- V1-24C Shared-only 可见性 Fixture 已补齐：示例 Shared Pack 中的“共享示例花”现在关联 `SHARED-DEMO-001` performer Work，不再因人物库的 performer 关系收口规则而被过滤。

## V1-27C 当前状态

Maker / Label / Series Registry Foundation 已通过 V1-27A/V1-27B 验证；V1-27C 首次建立 Registry Evidence → Community Catalog 的 Canonical 晋升链路。当前 Community Catalog 为 22 Maker / 13 Label / 9 Series；当前 Demo / Private Library 自身仍可保留独立自定义实体，Browse 会在“无作品 / 全部”中与只读 Community Catalog 合并显示。
