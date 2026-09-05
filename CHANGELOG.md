# Changelog

## V1-27 Maintenance - Desktop Page Modularization I

- 将 Desktop 首页、作品库/详情、人物库/详情从 `App.tsx` 拆分为独立页面模块，顶层入口继续只负责 Runtime、Library Profile、导航和页面选择。
- 页面继续通过 `TauriLibraryRepository` 与共享 Query/Application Core 工作，没有扩大 Native 文件权限或复制业务规则。
- 首页最近作品从固定 6 条扩展为最多 12 条，并增加“查看全部作品”入口，进入现有 Works Explorer。
- 首页合并重复 Works 查询：同一次结果同时计算总数、最近作品、相关人物和人物作品数，减少 JSON Repository 全量扫描。
- Desktop Boundary Validator 跟随模块边界读取对应页面文件，继续守住详情页、Gallery、Presentation 与查询语义。
- 第二批将资料包与设置页迁入独立模块，`App.tsx` 只负责全局状态、持久化和页面组合。
- 第三批迁出 Media 工作台及其专属 Adapter / Importer / 状态展示 helper，并明确扫描编排与 React 展示的边界。
- 新增 `docs/development/v1-27-desktop-page-modularization.md` 说明拆分原则与后续 Media / Packs / Settings 顺序。

## V1-27 Maintenance - Documentation / Gallery Consistency

- 修正文档与当前实现的偏移：README 完整列出 `pnpm check` 检查链，Series 模型统一记录当前 `parentOrganizationId` 关系。
- `registry:audit` 默认改为检查 Community Catalog，避免把 Demo Library 的 2 Maker / 2 Label / 3 Series 误报成社区目录审计结果；仍可通过 `--library` 检查指定资料库。
- Work Detail 画廊恢复 `poster / cover` 浏览，并继续显示 gallery / fanart / screenshot；图片使用与舞台同尺寸的绝对定位图像框，避免 Grid 固有最小尺寸让横图和竖版封面溢出后被截断，并按实际宽高切换 portrait / square / landscape 舞台。
- 新增 ADR-041，明确完整封面可见性优先于旧版“横图 Hero only”策略，且不改变 Canonical 或 Native 读取边界。

## V1-27D - Entity Localization & Browse Relationship Presentation

- Community Catalog 增加 `nameKinds`，区分来源原名、审核品牌写法、社区翻译与社区转写，避免把社区显示名伪装成官方名称。
- Maker / Label / Series 开始补充保守的多语言显示名；品牌无可靠中文名时继续回退原名，不为了三语齐全而硬翻。
- 当前 Community Organization 35 项中：英文显示名 34 / 35，中文显示名 6 / 35；Series 9 项中：英文 8 / 9，中文 7 / 9。
- Community Catalog JSON / CSV 同步增加 `name_kind_ja / name_kind_zh_cn / name_kind_en`，Validator 校验每个已存在名称必须拥有合法名称性质。
- Desktop Browse 的 Label / Series 卡片会显示已确认父级 Maker / Label；没有可靠 parent 时不猜测。
- Browse 明确保持“看完整目录”的定位，不增加 Maker → Label → Series 级联筛选；组合筛选留给 Works 多维筛选。
- 卡片搜索同时包含已显示的父级关系文字，方便按已确认所属组织定位目录项。
- 新增 `docs/catalog/entity-localization-and-browse.md` 固化多语言与 Browse/Works 职责边界。

## V1-27C - Community Catalog Projection

- 新增 `resources/catalogs/`，把 Registry Evidence 与人工审核后的 Canonical Community Catalog 正式分层。
- 首批 Community Catalog 收录 22 Maker / 13 Label / 9 Series，共 44 个 Canonical Entity。
- Registry Evidence 新增 `canonicalId` 映射；当前 54 / 67 条 Evidence 已归并到 Community Catalog，证据不足的 name-only 记录继续留在 Registry。
- 新增 `pnpm validate:catalog`，校验 Catalog JSON/CSV 一致性、Canonical ID/kind、Label/Series parent，以及每个 Catalog Entity 至少拥有一条 verified Registry Evidence。
- `pnpm check` 接入 Community Catalog Validator。
- Desktop Browse 将当前 Library Profile 实体与只读 Community Catalog 合并：“有作品”仍只看真实 Work 关联，“无作品 / 全部”可浏览尚无作品的社区 Maker / Label / Series。
- 搜索会同时匹配 Community Catalog 的 Canonical 名称和已审核 Alias；当前资料库同 ID 实体优先保留本地显示名。
- Genre 分面按钮区增加上下间距，修复小分类按钮与题材卡片过于贴近的问题。
- 新增 `docs/catalog/library-profile-registry-community-catalog.md`，明确 Library Profile、Registry Evidence、Community Catalog 与 Shared Pack 的职责边界。
- 清理误入上一阶段的 FANZA 在线快照脚本；Localogue Community Data 继续只维护静态审核资料，不集成在线采集/API 客户端。

## V1-27B - Provider Registry Coverage Round 1

- Organization / Series Registry 从 Foundation 进入第一轮真实 Provider 覆盖。
- Provider capability 从 4 扩展到 8，加入 S1、IDEAPOCKET、MOODYZ、Madonna 官方站独立 ID namespace。
- Organization Evidence 从 18 扩展到 58；新增 FANZA 22 个 Maker ID、12 个 Label ID 的可复核切片，并保留 2 条作品样本 Label name-only Evidence。
- 新增 `series-source-evidence.{json,csv}`，首批收录 9 个 Maker 官方站可公开复核的 Series 数字路径 ID。
- Registry 累计 45 个 verified Provider ID + 22 条 name-only Evidence。
- Validator 不再硬编码 Provider 列表，而是以 `provider-entity-sources.*` 为来源注册表；新增 Series Evidence、name-only 重复和跨文件 Provider/entityKind/sourceId 唯一性检查。
- 新增 `pnpm registry:coverage`，按 Provider / Maker / Label / Series 汇总仓库内静态 Evidence 的 verified 与 name-only 覆盖；命令不访问网络。
- 本轮仍不根据名称相似度自动合并 Maker / Label / Series，也不把 Maker 官方站 Series ID 当作 FANZA/JAVBus/JAVDB ID。


## V1-25C - Provider ID Identity / Coverage Round 2

- 产品版本继续保持 `0.1.25`；继续建立在尚未提交的 V1-25A/B Provider Coverage 工作上。
- 修复 `report-provider-coverage.mjs` 的 ESLint unused `error` warning。
- `genre-source-aliases.*` 新增 `idSource` / `idStatus`：`sourceId` 的 Provider 身份与跨站 label Evidence (`sources`) 正式分离。
- 旧 67 条 Alias 中，32 条 JAVDB legacy web-filter ID 与 1 条已公开 API 核实的 JAVBus `e=巨乳` 获得明确 Provider 归属；其余旧 ID 暂标 `legacy-unscoped`，不再凭 `sources` 猜 Provider。
- 加入 5 条经 JAVBus 页面/公开文档直接核实且可安全映射到 Canonical Genre 的 ID Alias：`3f=深喉`、`7i=孕ませ`、`4=中出`、`1y=其他戀物癖`、`6j=温泉`，Approved Genre Source Alias 增至 72。
- JAVBus Provider Catalog 从 Round 1 的 35 条收紧为 9 条真正有 Provider 级证据的 ID/name；另含 `2t=花癡`（Review）、`4o=高畫質`（Source-only）、`f=單體作品`（Work Type）。
- JAVLibrary 286 label 快照保持完整，但撤销从跨站 Alias 继承的未验证 ID；当前只保留独立公开文档核实的 `a4hq=韓国`。
- JAVDB 32 条现有 ID 明确标记为 `legacy-web-filter` namespace；现代 `/api/v2/tags?type=0..4` numeric tag dictionary 待可复核实时导出后以独立 namespace 接入。
- Classification Alias 增至 1166（1131 approved / 35 review-required），补充 JAVBus 繁中真实 label 的精确路由。
- Vocabulary Validator 新增 Provider/sourceId 唯一归属、Provider Catalog 归属冲突与 `genre-source-aliases.csv/json` 同步检查。

## V1-25B - Provider Coverage Round 1

- 产品版本继续保持 `0.1.25`；本轮建立在未提交的 V1-25A Vocabulary Coverage 基础上。
- 新增 `provider-genre-catalogs/`，把 Provider 原始分类与 Localogue Canonical Vocabulary 分离保存。
- 收集 FANZA 2026-03-20 标签快照 260 条；新增稳定 Canonical Genre 后，覆盖结果为 194 Genre / 19 Work Type / 21 Source-only / 26 Review / 0 Unmapped。
- 收集 JAVLibrary 2025-03-29 标签快照 286 条；覆盖结果为 227 Genre / 27 Work Type / 23 Source-only / 9 Review / 0 Unmapped。
- 将现有 Approved Provider ID Alias 拆出 JAVBus 35 条与 JAVDB 32 条 verified ID slice；明确它们不是全站分类总数。
- Canonical Genre 从 320 扩展到 359，补充 Athlete、Otaku、Grandmother、Aunt、Yakuza、Partner Swapping、Cheerleader、Harem、Boys Love、V-Cinema、Wetting、Vomit、Nose Hook 等真实来源概念。
- Source-only 从 46 扩展到 51，新增 Taiwan Region、Vertical Video、Bundle Product、Exclusive Distribution 与 Provider Marketing Campaign，避免 FANZA 平台/促销词污染 Genre。
- Classification Alias 从 1101 扩展到 1161（1127 approved / 34 review-required）；复合词继续显式 Review，不强制单目标。
- 新增 `pnpm vocabulary:provider-coverage` 汇总四个 Provider 覆盖率；新增 `pnpm validate:provider-coverage`，要求已收集快照没有 Unmapped / Runtime Ambiguous。
- `pnpm check` 接入 Provider Coverage 回归检查。

## V1-25A - Vocabulary Coverage & Source Mapping

- 产品版本升级为 `0.1.25`。
- 将 `localogue-community-data` 323 条 Classification 全量建立 Crosswalk：根据语义进入 Canonical Genre、Work Type 或 Source-only，不再把 Community 分类机械等同于 `Work.genreIds`。
- Canonical Genre 从 33 扩展到 320，Work Type 从 8 扩展到 43；旧稳定 ID 和原有显示名称保持兼容。
- 新增 46 个 Source-only Classification，覆盖生命周期、媒体格式、内容评级和分类表分段标题。
- 新增 1101 个 Classification Term Alias：1089 个单目标 approved 可精确自动路由，12 个复合/多义词保留 `review-required`，禁止自动同时写入多个 Canonical。
- 系统吸收两份 MetaTube 日文分类参考表中可稳定复用的词条；参考表翻译只作为 Evidence，不直接覆盖 Canonical Display Name。
- 修正 `ハメ撮り` 与 `主観` 语义混并：`主観 -> pov`，`ハメ撮り -> pov_recording`；Provider sourceId `1g` 同步修正。
- Import Classification Normalizer 改为读取受控词表和 Approved Alias，移除仅 8 个 Work Type / 少量 Source-only 的硬编码扩展瓶颈；Alias 冲突一律 fail closed。
- Genre Localization 同步支持 Approved Classification Alias，并对多目标/冲突词拒绝猜测。
- 新增 `pnpm validate:vocabulary`，校验稳定 ID、三语名称、Crosswalk target、Alias 单目标约束、Provider Alias、JSON/CSV 同步和关键映射回归。
- 新增 `pnpm vocabulary:coverage -- <file>`，可对 TXT / CSV / JSON 分类词表生成 Genre / Work Type / Source-only / Review / Unmapped 覆盖率报告。
- `pnpm check` 现在包含 Vocabulary Validator。

- 修复 V1-24B 之后真实本地 Work 图片回归：早期 Desktop 导入的 fanart / screenshot 没有 width / height 时不再被 Hero Gallery 静默过滤；未知尺寸候选会在实际图片加载后用 naturalWidth / naturalHeight 二次校验，竖图仍不会进入顶部横版画廊。
- Work Presentation 候选从仅 poster / cover 扩展为 poster / cover / gallery / fanart / screenshot；默认仍优先 poster → cover，只有用户显式选择时才会用其它作品图片作为私人显示首图，Web / Desktop 语义同步。
- 修正 Starter Shared Pack 的 Shared-only 人物演示：新增 `SHARED-DEMO-001` performer Work 与只读 Poster，使“共享示例花”符合 Desktop 人物库按 performer 作品关系收口的规则，并可直接验证 Shared-only Person / Work / Asset。

## V1-24C - Portable Pack / Presentation / Asset Closeout

- Personal Portable Import 增加多 Profile 目标锁：Import Plan 记录生成预览时的 Private Library；切换资料库后 UI 禁用旧预览确认，Native 写入前再次核对 expectedLibraryPath，避免把 A 库备份误导入 B 库；Native Contract 升至 revision 6。
- Portable Workbench 明确显示“导入目标”，并提供“放弃预览”；目标 Profile 改变后要求重新选择 Pack，而不是继续使用过期 Import Plan。
- “添加示例库”现在同时把 Dev Fixture Private Library 与 Starter Shared Pack provision 到 App Local Data；旧版只有 `Private + 0 Shared` 的示例 Profile 会在 Native Contract revision 5 下自动修复为稳定的 `Private + 1 Shared`，普通用户自建资料库仍默认不挂 Shared Pack。
- Personal Portable Pack 增加导入前结构化 Import Plan：逐文件区分新增、完全相同与内容冲突，并按 Canonical / Asset Metadata / Asset Files / Presentation / Audit 分类统计；既有冲突继续安全跳过，不覆盖本地资料。
- Portable Pack 预览增加 Presentation / Asset 完整性检查：缺失 Private Asset 二进制、Asset JSON 与二进制 SHA-256 不一致、Preference 引用 Pack 外 Asset 都会显式呈现，其中摘要冲突会阻止导入。
- Personal Import 返回结构化结果报告，显示导入/跳过数量、完全相同/冲突跳过和分类统计；导入后重新执行 Private Asset Storage Health，继续报告 Asset 文件缺失。
- Portable Pack UI 明确显示当前 Library Profile / Private Library，Personal Backup 改为“当前资料库备份”，不把 Profile 路径、实例设置、媒体视频或 Shared Pack 内容混入备份。
- Native Personal Import 除目录白名单外继续检查目标路径树中的 symlink / Windows Reparse Point，避免已有子目录把写入重定向到 Private Library 之外。
- Shared Portable Pack 继续使用临时目录校验后原子安装；Native Runtime Contract 升至 revision 5，并新增 `preview_private_portable_files` 最小命令与 ACL。
- 新增 `docs/desktop/portable-pack-and-profile-backup.md`，固化多 Profile 场景下的备份范围、冲突策略、Presentation / Asset 迁移与安全边界。
- 产品版本继续保持 `0.1.24`。

## V1-24B - Person Portrait / Gallery Asset Governance

- V1-24B 收尾：Desktop 图片读取从 Private-only Reader 升级为受控 `Private > Shared Pack` Asset Source Resolver；Webview 只提交 `Asset.id + storagePath`，Native 重新按当前 Profile 的资料源优先级定位 Asset JSON，并且每个来源只能读取自己的 `asset-files/`，Shared Pack 继续只读。
- Starter Shared Pack 新增 Shared-only 人物 `person_shared_demo_001` 的 Portrait Asset 与真实 JPEG，用于在干净 Fixture 中直接验收“共享人物头像可显示、Shared 资源不可写/不可清理”。
- Media 页新增“资源文件健康”：统计当前 Private Library 的 Asset 元数据、托管引用、磁盘文件、孤儿文件、缺失文件与可回收空间；清理操作只删除 `asset-files/` 中没有任何当前 Asset JSON 引用的普通孤儿文件。
- 孤儿清理由 Native 在执行瞬间重新读取最新 Asset JSON 计算，不接受 Webview 传入删除路径；符号链接、越界路径、非 `asset-files/` 引用和 Shared Pack 文件均不会自动删除。
- 新增 `pnpm desktop:demo:orphan` 固定制造一个无 Asset JSON 引用的 Dev Fixture 图片文件，并新增 `pnpm desktop:rust:test` / Rust 单元测试覆盖“只删孤儿、不删受管文件、缺失引用只报告”的安全行为。
- Native Runtime Contract 升至 revision 4，并把 Shared Asset Reader / Asset Storage Health / Cleanup 命令加入 Desktop ACL 与 Boundary Validator。
- 修复开发环境示例库刷新仍命中旧 Tauri Resource 的问题：Debug Runtime 优先解析当前仓库 `examples/`，产品 Release 继续只读取 `$RESOURCE`；示例库 provision 改为比较整个模板目录的确定性 SHA-256 内容签名，而不是只比较 `fixture-info.json`。
- 将本轮新生成的 3 张 16:9 海滨横图正式并入 `DEMO-002` Work Gallery，示例库扩展为 43 Assets，并增加多图 Gallery 轮播 Fixture 场景。
- 修正 V1-24B Work Detail Hero Gallery 回归：顶部画廊只接受明确横版 gallery / fanart / screenshot / 横版 cover，竖版 poster 不再作为回退；没有横版资产时直接省略 Hero Gallery。
- Dev Fixture 为全部 11 部作品新增独立宽幅 Work Gallery Asset，并为 DEMO-002 增加 3 张额外 16:9 多图轮播素材，示例库从 29 Assets 扩展为 43 Assets。
- Person Detail 新增 Portrait / Gallery 浏览与 Private Asset 管理工作台，可直接导入头像或 Gallery 图片。
- 新增受限 Native Image Picker；图片仍必须经过 `import_private_asset_file` 的扩展名、签名、25 MB 与 Private `asset-files/` 边界。
- 人物 Gallery 导入会更新 Private Person 的 `galleryAssetIds`；首次 Portrait 可补默认 `portraitAssetId`，后续显示选择继续由 Presentation Preference 控制。
- Person Asset 删除先解除 Private Person 引用，并继续受 Presentation Preference / Shared Pack 只读保护；二进制 content-addressed 文件默认保留。
- Native Runtime Contract 升至 revision 3，避免新图片管理 UI 与旧 Rust Runtime 混用。
- `validate:fixture` 开始要求所有示例 Work 同时拥有 poster/cover 与详情 Gallery/Fanart 资产；`validate:desktop` 同步锁定 V1-24B Native/Image 边界。
- 产品版本继续保持 `0.1.24`。

## V1-24 Foundation Cleanup - Library Profiles / Source Model / Rich Fixture

- 修复 Webview 已热更新但 Rust Native Runtime 仍停留在旧版本时的 Profile 假成功问题：Runtime 新增 `contractRevision=2`，Profile UI 在版本不匹配时阻止增删改切换并明确提示重启/重编译。
- Profile metadata mutation 不再经过 active path snapshot；重命名完成后还会核对 Native 返回的 Profile 名称，避免只显示“已重命名”提示但实际未持久化。
- `build.rs` 显式监听 Rust command、permissions、capabilities 与 Tauri 配置，降低覆盖补丁后复用旧 IPC / ACL 构建产物的概率。
- 示例库 `provision_example_library` 仍由专用 Native Command + ACL 提供；若开发环境残留旧 Native Binary，会被 contractRevision 直接识别，而不是继续产生 `Command not found` 与 Profile 列表回退。
- 修复 Library Profile 持久化：新建、切换、重命名、删除现在立即写入 Desktop Settings，避免只更新设置页临时状态后在侧栏/重启时丢失。
- `activeLibraryProfileId` 失效时，TypeScript 与 Rust 双层都回退到现有 Profile；已有 Profile 列表不再被兼容平面路径二次迁移成“幽灵资料库”。
- “添加示例库”改为真正的产品级一键初始化：Tauri Bundle 嵌入标准 Fixture / Starter Shared Pack，Native Runtime 自动复制可写示例库到 App Local Data，不再要求普通用户执行 `pnpm desktop:demo:reset`。
- 仓库 `desktop:demo:*` 命令继续保留给开发者重置 `var/dev-fixture-library`，与产品内置示例库运行副本明确分工。
- 新增 Desktop `Library Profile`，可把 Private Library、Unified Roots、额外 Media/NFO 路径和 Shared Packs 保存为“示例库 / 资料库 1 / 资料库 2”等独立配置。
- 侧栏新增当前资料库快速切换；切换只替换路径配置，不复制、移动或合并磁盘资料。
- Library Profile onboarding 收口：旧单库 Settings 自动迁移为 Profile；Dev Fixture 固定使用短名称“示例库”；普通新建项只生成“资料库 1 / 资料库 2 …”等中性默认名，不预设内容分类。
- 设置页新增真正的空白“新建资料库”和开发环境“一键添加示例库”，侧栏无论是否已有 Profile 都保留明确的资料库管理入口。
- Settings UI 收敛为“私人资料库（可写）/ 内容根目录（推荐）/ 只读共享资料 / 高级兼容目录”四层，高级 Media / NFO 路径默认折叠。
- Desktop Settings Contract 与 Rust Settings 增加向后兼容的 `libraryProfiles / activeLibraryProfileId`，Native 边界规范化 Profile ID、名称与路径。
- 修复配置多个额外媒体目录时“一键同步资料库”完成过早的问题；Unified Sync 现在等待全部媒体根目录真正扫描完成。
- 媒体扫描结果新增实际扫描目录数量、完整 roots 列表与 warning 展开，方便定位多目录配置。
- Desktop Vite / Rolldown 增加 React Vendor + Vendor code splitting，真实拆分大型 bundle，不通过调高 warning 阈值掩盖问题。
- Dev Fixture 扩充为 11 Works / 8 People / 29 张生成式 JPEG；11 部作品均有独立海报、8 位人物均有头像，6 位 performer 还配有独立 Gallery；DEMO 海报由生成式人物素材重新排版生成，不再使用低清裁切占位。
- 星野みづき、白石りん、朝倉みお、藤原はるか新增独立人物 Gallery；头像与作品海报均来自独立生成式素材，避免同一张综合预览图被裁切复用。
- 恢复 `DEMO-IMPORT-001` JSON 与 `DEMO-IMPORT-002` NFO 兼容示例，并继续保留 LX 系列 Import / Review Fixture。
- `validate:fixture` 增加最小规模、旧 Demo identity parity、Library Profile 示例与 companion examples 校验；新增独立 `desktop-settings.example.json`，不把 Desktop-only Profile 字段混入 Web Instance Settings Schema。
- 新增 Library Profiles / Sources 用户文档与 ADR-040；明确 `localogue-community-data` 继续独立维护，由 Localogue 作为 Shared Pack 消费。
- 产品版本继续保持 `0.1.24`，本次属于 V1-24 架构与开发体验收敛。

## V1-24 Examples / Fixture Integration

- 将早期 `examples/people` 与 `examples/works` 独立结构示例并入 `examples/dev-library/template`，Canonical JSON 文档与可运行 Fixture 只保留一份真相。
- `sample-existing-work.json` 改为直接命中 Fixture `LX-101`，并故意将时长从 118 写成 121，任何干净环境都可稳定复现已有 Work 字段差异。
- JSON / NFO / CSV / XLSX 导入样例统一到 `LX-*` 虚构测试世界，复用 Fixture 人物、Maker、Label、Series 与 Vocabulary。
- `settings.example.json` 改为指向 `var/dev-fixture-library` 与 Starter Shared Pack，示例配置可以完整对应标准测试环境。
- Starter Shared Pack 新增与 Private 同稳定 ID 的 `person_fixture_aiko_mizuno` 共享层记录，显示名故意不同，用于验证 `Private > Shared` 优先级。
- `fixture-manifest.json` 新增 companions 与 `privateOverShared` 场景；`validate:fixture` 开始校验 Import / Settings / Shared Pack 联动，并阻止旧 `examples/people` / `examples/works` 被重新引入。
- `desktop:demo:*` 输出同时提示配套 Shared Pack 与 Review Import 路径，减少手工验收准备步骤。
- 产品版本继续保持 `0.1.24`；本次仍属于 V1-24 开发测试基础设施整理。

## V1-24 Dev Fixture Foundation

- 新增 `examples/dev-library/` 可重置 Desktop 开发 Fixture，不再依赖开发者本机真实 Private Library。
- Fixture 提供 3 部虚构 Work、2 位虚构 Person、10 个 Private Asset、3 条 Presentation Preference，并覆盖有效偏好、默认回退与 stale 偏好。
- 10 张 portrait / gallery / poster 图片由生成式模型制作并压缩为仓库内 JPEG，离线即可测试 Native Asset Reader 与真实图片布局。
- 新增 `fixture-manifest.json` 固定测试 Scenario ID，供手工验收和未来 E2E 复用。
- 新增 `pnpm desktop:demo:seed / reset / clean`，运行副本固定写入 Git 忽略的 `var/dev-fixture-library/`；脚本不会自动修改用户 Settings。
- 新增 `pnpm validate:fixture`，校验 JSON 引用、Asset 路径、JPEG 签名、fileSize、SHA-256 与 Presentation 场景完整性。
- `pnpm check` 开始包含 Fixture 校验，避免后续 Domain / Asset 重构让开发样例悄悄失效。
- 产品版本继续保持 `0.1.24`；本包属于 V1-24 开发基础设施，不单独提升产品版本。

## V1-24A - Desktop Presentation Preference Workbench

- Curation 新增 Presentation 子视图，集中管理 Work 首选封面与 Person 首选头像。
- Work Detail / Person Detail 新增私人展示图片 Picker，并支持一键恢复 Canonical / 自动默认。
- Desktop Home、Works 与 People 浏览统一应用 `PresentationPreference`，避免各页面展示结果漂移。
- 新增共享 Presentation Resolver：Work 仅接受 poster / cover，Person 仅接受 portrait / gallery，并显式报告 stale preference。
- Tauri 新增专用 Private Presentation Preference Reader / Writer；写根仍由当前 Desktop Settings 的 Private Library 决定。
- Native Asset 删除新增 Presentation Preference 引用保护，防止产生静默悬空引用。
- Presentation Preference 继续只保存私人显示选择，不改写 Canonical Entity，也不写入 Shared Pack。
- Desktop Permission / ACL / I18N / Boundary Validator 同步覆盖 V1-24A。
- 根目录继续只维护单一 `MANIFEST.md`，不新增版本化 Manifest。
- 产品版本升级为 `0.1.24`。

## V1-23 - Desktop Governance Parity

- Desktop 新增 Review / Curation / History 一级导航。
- NFO Preview 可保存为不可变 Evidence，并进入字段/实体 Review。
- 复用共享 Entity Resolution、Review Decision、Commit Plan、Curation 与 Provenance Application Service。
- Commit Plan fingerprint 去除 `node:crypto` 依赖，改为浏览器中立同步 SHA-256。
- Native Audit Reader/Writer 新增治理集合白名单，写根只能来自当前 Private Library 设置。
- Canonical Commit 前创建最小 before-image Snapshot；中途失败自动恢复。
- History 支持显式 Restore，并追加 Restore Receipt / Provenance，不删除历史 Commit Receipt。
- Packs 页面新增 Personal Backup 与 Shared Library Archive `.localogue-pack` 导入导出。
- Personal Import 失败回滚本轮新建文件；Shared Import 使用临时目录校验后 rename。
- Portable Pack 继续使用严格路径白名单、SHA-256 与 256 MiB 安全上限。
- Tauri Permission / ACL / TypeScript Contract / Desktop Validator 同步新增 Governance 与 Portable Commands。
- 产品版本升级为 `0.1.23`。

## V1-22 Hotfix 3 - Detail Hero Cleanup & Curated Genre Vocabulary

- Work Detail 顶部 Hero Gallery 不再展示 poster；poster 继续用于作品墙、列表、首页与人物相关作品封面。
- Hero Gallery 仅展示更适合宽屏浏览的 fanart / screenshot / gallery / cover 等图片；如果没有兼容资产则直接进入 Metadata，不强制创建空画廊。
- 移除完整 `source-genre-catalog.{csv,json}` Runtime 方案，不再把用户提供的 1271 条混合来源分类原样固化进仓库。
- 从参考表中人工提取 67 条明确来源别名，新增 `genre-source-aliases.{csv,json}`，所有别名必须指向现有 Canonical Genre。
- Canonical Genre 从旧 15 项校正并扩充为 33 个明确内容题材。
- `デビュー作 / 周年 / ハイビジョン` 从 Genre 移除，`有码 / Blu-ray` 等也保持 source-only，不进入题材 Facet。
- 新增美少女、主观视角、潮吹、口交、自慰、绝顶高潮、内射、女仆、护士、女教师、凌辱、接吻、乳交、骑乘位、手交、颜射、吞精、肛交、拘束、SM、偷窥等受控 Genre。
- Import Classification Normalizer 改为读取 `genres.*` + `genre-source-aliases.*`，避免代码/资源双重真相。
- Vocabulary Repair 会移除早期误建的 `first_work / anniversary / high_definition` Genre 引用。
- 新增 ADR-038 与 Approved Genre Source Aliases 文档，并要求删除旧 Source Genre Catalog 文件。
- 产品版本继续保持 `0.1.22`，作为 V1-22 Vocabulary / Presentation Hotfix。

## V1-22 Hotfix 2 - Adaptive Work Media Gallery & Fluid Desktop Layout

- 修复纵向 poster / cover 在固定横向 Gallery Stage 中显示过小的问题。
- Work Media Gallery 根据图片真实宽高比切换 portrait / landscape / square 展示策略。
- poster / cover / portrait 在首帧读取前采用纵向预判，图片加载后再以 naturalWidth / naturalHeight 校正。
- portrait Gallery 使用更高的视口高度并继续 `object-fit: contain`，完整展示纵向海报而不裁切。
- 移除 Desktop 主内容区固定 `max-width: 1460px` 思路，改为跟随窗口可用宽度流式伸展。
- 2K / 4K 和宽屏窗口下 Works Table、Facet、Browse、People 与 Work Detail 可真正利用右侧空间。
- 超宽屏仅增加响应式 padding / Facet Rail，不再通过固定 Content Max Width 制造右侧空白。
- Desktop 顶栏阶段文本改为读取 Runtime Version，不再硬编码 V1-20。
- Desktop Boundary Validator 新增 Gallery Orientation 与 Fluid Content Width 回归检查。
- 产品版本继续保持 `0.1.22`，作为 V1-22 Presentation Hotfix。

## V1-22 Hotfix - Desktop Delete Type Sync & Work Media Gallery

- 修复 `DesktopDeletableLibraryCollection` 未同步 Native `genres / tags` 受控删除白名单导致的 `TS2345` 编译失败。
- Desktop Boundary Validator 新增 Rust / TypeScript 删除集合一致性检查，避免跨层白名单再次漂移。
- Work Detail 从固定“左图 + 右侧长字段表”调整为“顶部全宽媒体画廊 + 下方全宽 Metadata Table”，消除图片高度有限时左栏底部大块空白。
- 顶部画廊按 poster → fanart → screenshot/thumb → cover → 其他图片排序，只读取当前图片，支持左右箭头和轻量标签切换。
- 画廊结构为后续视频预览图 / 更多截图保留统一扩展入口。
- 底部 Local Asset 区改为紧凑管理列表，避免与顶部画廊重复展示整组大图片。
- 产品版本继续保持 `0.1.22`，作为 V1-22 实机热修。

## V1-22 - Desktop Information Architecture & Metadata Localization

- 修复 Desktop 选择 Facet、分页或切换语言时页面回跳顶部的问题，结果刷新改为 stale-while-refresh。
- Works / People / Browse / Detail 刷新时保留旧 DOM 高度，并在原位置显示轻量“正在刷新”状态。
- Query 更新与 page=1 合并为单次状态切换，减少无意义的连续 Repository 请求。
- 主语言控制默认同时切换 UI Language 与 Metadata Language，并保留高级 Metadata Language 独立覆盖。
- Work Type 和 Person Activity Status 等受控枚举改为三语用户名称，不再暴露 raw stable id。
- 中文 UI 的 Genre / Tag 业务标签统一为“题材 / 标签”。
- 新增用户提供的 1271 条 Source Genre Catalog（ja / zh-CN / zh-TW / en），保留来源、URL/ID 与 note。
- Source Genre Catalog 只用于翻译补全、来源参考和映射候选，不自动将来源站混合分类晋升为 Canonical Genre。
- Desktop / Web Genre Facet、索引和详情统一使用 `localizeGenre`。
- Vocabulary Audit 的 unmapped 来源词命中 Source Genre Catalog 时显示当前 Metadata Language 的词表参考。
- Work Detail 重构为顶部媒体画廊 + 下方全宽高密度 Metadata Table，将发行日期、时长、演员、导演、Maker、Label、Series、Work Type、题材和标签放在同一主信息区，并避免左图右表在长信息下产生大块空白。
- Work 编辑器默认收紧闭合空间，本地 Asset 区域减少卡片尺寸与间距。
- 新增 Source Genre Catalog 文档、ADR 与 V1-22 实现导读，并扩展 Desktop Boundary Validator。
- 保持 V1-18 Hotfix 3 Unified Library / Native I/O / SHA-256 稳定修复不变。

## V1-21 - Vocabulary Governance & Work Metadata Visibility

- 修复 NFO `<genre>/<tag>` 混合桶被直接复制到 Canonical Genre / Tag 的问题。
- 新增共享 Import Classification Normalizer：Series / Maker / Label / Work Type / controlled Genre / explicit Tag 分流。
- `系列:` 进入 Series；`单体作品 / イメージビデオ / VR` 等进入 Work Type。
- 番号前缀、演员名、片商、发行与未知来源词不再自动成为 Genre / Tag。
- 未知来源分类生成 `unmapped_classification` warning。
- 新增 `resources/vocabularies/import-term-mappings.json/.csv` 与 `docs/vocabulary/import-term-mappings.md`。
- Desktop 本地资料页新增“分类词表审计” Preview → Explicit Repair。
- 历史修复只处理 `genre_nfo_* / tag_nfo_*`，保留用户手工 Tag。
- Repair 可迁移 Series / Work Type / controlled Genre，并清理无引用旧 NFO Genre / Tag。
- Rust Canonical Delete 增加受引用保护的 Private Genre / Tag 清理能力。
- Work Detail 分开展示作品类型 / Genre / Tag 的本地化名称。
- Work Editor 新增 Work Type 多选编辑。
- Desktop Boundary Validator 固化 Vocabulary mapping 代码 / resources / docs 同步要求。
- 保持 V1-20 UX/I18N 与 V1-18 Hotfix 3 Unified Library / Native I/O 稳定实现不变。

## V1-20 - Desktop UX & I18N Parity

- Desktop 主导航默认收窄并支持显式折叠 / 展开，折叠状态本机持久化。
- Works / Person related Works 的 Facet Rail 加宽并允许长筛选项换行，减少 Maker / Series / Genre 文本截断。
- Work Detail 本地 Asset 固定按 poster → fanart → screenshot → cover → 其他排序。
- 用户可见 Asset 语义统一为海报 / 背景图 / 缩略图 / 封面，并提供日本語 / English 对应标签。
- 新增 `DesktopI18nProvider` 与顶部双语言控制：UI Language、Metadata Language 独立切换。
- Desktop 支持 `zh-CN / ja / en` 三种 UI 语言，并让 Work / Person / Organization 等展示尊重 Metadata Language。
- 语言偏好使用与 Web 同语义的 `localogue_ui_language` / `localogue_metadata_language` 键，但 Desktop 本机使用 localStorage 持久化。
- 语言和 Sidebar 偏好只影响 Presentation，不修改 Canonical Library。
- 首页统计、媒体/NFO/Asset 扫描统计、ffprobe 信息、Work 编辑器与作品表格等残余固定英文标签统一接入 Desktop I18N。
- Desktop Boundary Validator 新增 `t()` 字面量翻译覆盖审计：日文 / 英文缺 key 或两张表 key 不一致会直接使校验失败。
- 保持 V1-19 Query/Facet 行为与 V1-18 Hotfix 3 Unified Library / Native I/O 安全链不变。

## V1-19 - Desktop Discovery & Presentation Parity

- 首页最近作品改用真实 poster / cover 卡片。
- 新增 `DesktopWorkExplorer`，对齐 Web 完整 Work Facet、动态计数、Chips、分页和三视图。
- Person Detail 相关作品复用完整 Work Explorer，解决无图和不能二次筛选的问题。
- 新增 `DesktopPersonExplorer`，对齐人物状态、出生/出道/引退年份、身高与排序筛选。
- 人物卡和 Person Detail 支持已存在 portrait Asset 的安全显示。
- 新增 Desktop Browse：Maker / Label / Series / Genre / Director / Work Type / Tag 分类索引，并可继续组合 Work Facet。
- 保持 Web/Desktop 共用 `library-query` Query Core。
- V1-18 Native I/O Stack Safety、Unified Sync 和 Shared Pack 只读边界保持不变。

# 更新日志

## V1-18 Hotfix 3 · Native I/O Stack Safety

- 修复 Unified Library 第一次真正导入本地 poster / fanart / thumb 时可能因 `sha256_path()` 在 Native Command 栈上分配 1 MiB 固定数组而触发 `STATUS_STACK_OVERFLOW` 的问题。
- SHA-256 流式缓冲从 `[0_u8; 1024 * 1024]` 改为堆分配 `vec![0_u8; 256 * 1024]`，Native 栈占用保持常量级。
- `stat_path`、`path_exists`、`read_nfo_text`、`import_private_asset_file`、`read_private_asset_bytes`、`sha256_file`、`read_library_collection`、Canonical/Audit Writer 与 Delete 改为 async + blocking worker。
- ffprobe 进程等待也移出 async command 调用线程，避免阻塞 Runtime。
- 新增 `native_io #N ... queued/start/ok/error` 终端诊断，可精确定位高频 Native I/O 的最后成功阶段。
- Desktop 关闭旧式图片 sidecar observation 时，媒体 discovery 只请求视频扩展名，不再额外把 NFO 混入“仅扫描视频”的返回集合。
- Desktop Boundary Validator 新增大固定栈缓冲禁令与高频 Native I/O async 回归规则。
- Hotfix 1/2 的迭代目录扫描、junction/reparse 防环与 Windows 特殊卷兼容继续保留。
- 产品版本继续保持 `0.1.18`。

## V1-18 Hotfix 2 · Windows Volume Scan Compatibility

- 修复第一版扫描 Hotfix 在部分 Windows 卷、虚拟盘、网络/挂载卷上因 `fs::canonicalize(root)` 返回 `os error 1005`，导致“同步资料库”和“仅扫描视频”在 discovering 阶段直接失败的问题。
- 扫描根改为以 `metadata + read_dir` 判断真实可读性，不再要求卷必须支持 canonical final path。
- 使用词法绝对路径作为扫描期 visited key；Windows 下按大小写不敏感方式去重。
- 继续拒绝 symlink 与 reparse/junction 目录下钻，保持目录环防护。
- 仅对 reparse 目录做阻断，普通 reparse 文件继续允许进入扩展名筛选，兼容 Cloud Files / 虚拟卷文件。
- 根目录不可枚举时返回包含实际扫描根的明确错误，子目录不可读仍采用记录并跳过策略。
- 保持 `VecDeque` 迭代扫描、`spawn_blocking` 后台 I/O、100000 目录上限和 V1-18 数据模型不变。
- 产品版本继续保持 `0.1.18`，作为 V1-18 第二个实机兼容性补丁。

## V1-18 Hotfix · Unified Library Scan Stack Overflow

- 修复 Windows 实机执行“同步资料库”时可能出现 `STATUS_STACK_OVERFLOW (0xc00000fd)` 并导致 Desktop 进程直接退出的问题。
- `walk_files` 从同步主线程扫描改为 `async command + spawn_blocking`，目录枚举不再占用 Tauri 主线程。
- 移除 `walk_files` 对 `WalkDir` 的直接使用，改为 `VecDeque` 显式迭代目录队列，目录深度不再消耗 Rust 调用栈。
- 使用 canonical path `visited` 集合去重已访问目录，防止路径别名重复遍历。
- Windows 明确拒绝符号链接、junction 与其他 `FILE_ATTRIBUTE_REPARSE_POINT` 子目录继续下钻，阻断目录环。
- 增加 100000 个目录的安全上限，并对不可读目录/条目采用跳过 + 终端诊断，而不是使整次同步崩溃。
- Native 终端新增 `walk_files start/completed/reached file limit` 诊断日志，后续可精确判断 NFO、Asset 或 Media 哪一轮目录枚举发生异常。
- 不改变 Unified Root、NFO → Asset → Media 顺序、Work/Asset 数据结构和现有媒体增量扫描语义。
- 本 Hotfix 保持产品版本 `0.1.18`，作为 V1-18 的稳定性补丁，不占用后续 V1-19 路线版本。

## V1-18 · Desktop Presentation Parity & Unified Library Sync

- Desktop Works 对齐 Web 的海报墙 / 列表 / 表格三种展示方式；三种模式共享同一 Repository 查询结果。
- 新增 `DesktopWorkResults` / `DesktopWorkViewSwitcher`，视图偏好保存在 Desktop localStorage。
- Work poster 解析同时兼容 `Work.assetIds` 与 `Asset.subjectId` 关系，优先 poster、其次 cover。
- 新增 `DesktopAssetImage`，通过受限 Tauri IPC bytes + Blob URL 实际渲染 Private 本地图片。
- Rust 新增 `read_private_asset_bytes`：写死当前 Private Library/asset-files 边界，拒绝绝对路径与 `..`，限制图片扩展名、大小并校验 magic bytes。
- 不为动态 Private Library 开启宽泛 asset protocol scope，继续保持 WebView 最小本地文件读取面。
- Work Detail 新增真实首图与关联 Asset 图片预览。
- Media 页面新增“一键同步 Unified Library”，固定按 NFO → Asset → Media 顺序执行。
- 一键同步会在 NFO 导入后重新扫描图片，使新建 Work 可以立即接收 poster / fanart / thumb。
- 继续保留“仅扫描视频”和“NFO + 图片 Preview / Import”作为高级可控入口。
- 既有 size + mtime 增量媒体扫描保持不变，元数据同步不会强制重复所有 ffprobe / SHA-256。
- 新增 ADR-034、V1-18 实现导读与 Manifest。
- 项目、Desktop Workspace、Rust Crate 与 Tauri 配置升级至 0.1.18。

## V1-17 · Unified Library Source & Desktop Interaction Parity II

- Desktop Works 新增 Private Work 创建、详情编辑与受引用保护的 Private 删除；Shared Work 保存为同 ID Private Override。
- Work 编辑器可修改番号、标题、简介、日期、时长以及 performer/director、Maker、Label、Series、Genre、Tag 关系。
- Desktop People 新增 Person 创建、编辑与受引用保护删除；Shared Person 同样使用 Private Override。
- Works / People 增加核心搜索、筛选与排序交互，继续复用 Web/Desktop 共享 Query Core。
- Media 列表新增人工 Work 绑定治理：搜索、bind、rebind、unbind，并统一标记 `matchMethod=manual`。
- 新增受限 Desktop Private Audit Writer，仅允许写 `media-binding-receipts`；Receipt 写失败时补偿恢复 MediaFile。
- Packs 页面升级为可管理：挂载前 Native 校验、调整 Shared Pack 读取优先级、卸载并保存实例配置。
- Private Canonical 删除白名单开放 `works / people / assets / media-files`，Rust 在删除前执行引用检查；Shared Pack 仍无写/删入口。
- 新增 ADR-033 与 Desktop Interaction Parity 实现导读。
- 新增 `libraryRoots` 统一资料源根目录；一个共同父目录可递归发现不同子目录的视频、NFO 与本地图片。
- Web / Desktop 对 `libraryRoots` 使用相同设置语义；原 `mediaScanPaths / nfoScanPaths` 保留为高级兼容路径。
- Desktop Media 页面统一扫描 NFO + `poster / cover / fanart / thumb` 图片，并在导入前提供 Preview。
- Desktop Unified Root 按文件类型分流：目录名不参与媒体判断，`写真/` 等分类目录中的受支持视频照常扫描；图片由专门 Asset Ingest 处理，避免图片文件占用视频发现上限。
- 图片与 NFO / 视频不要求同目录，通过规范化 Work 番号关联；缺少直接番号时可用同 NFO stem 保守匹配。
- 同番号多 NFO 改为 Work Group 预览，`part1~partN` 不再显示成长串“重复番号”。
- 新增 Native Private Asset Import：限制图片类型与 25 MB 大小，校验 magic bytes，计算 SHA-256 后复制到 `asset-files/`。
- Asset 创建 `subjectType=work` 关系并加入 `Work.assetIds`，现有 poster/cover Presentation Resolver 可直接复用。
- 原始图片不移动、不删除；相同内容使用 SHA-256 内容寻址避免重复二进制。
- Desktop Work 详情新增本地图片数量与 Asset 类型 / 存储引用核对。
- Work 详情可显式解除并删除 Private Asset 元数据；Native 引用保护确保先解除 Work.assetIds，V1-17 不自动物理删除用户原图或 content-addressed 二进制。
- `assets` 加入受控 Private Writer；写根仍由 Rust 从 Desktop Settings 解析，Shared Pack 继续只读。
- 新增 ADR-032、V1-17 实现导读与 Manifest。
- 项目、Desktop Workspace、Rust Crate 与 Tauri 配置升级至 0.1.17。


## V1-16 · Desktop Feature Parity II — Independent NFO Library Ingest

- 新增独立 `nfoScanPaths`，NFO 元数据目录可与视频目录完全分离。
- Desktop Media 页面新增 NFO 扫描预览与显式批量导入。
- NFO XML 内番号优先；缺失时从文件名保守识别番号，并可从文件名补充发行日期 / 片名。
- 支持 `SONE-123`、`ABW001`、`300MIUM-123`、`FC2-PPV-1234567` 等典型命名。
- 同番号多 NFO 自动去重，优先元数据更完整、修改时间更新的候选。
- 新 NFO 可创建 Work / Person / Organization / Series / Genre / Tag；已有 Work 使用 fill / merge，不静默覆盖已有核心字段。
- Web / Desktop `findWorkByCode` 改为 compact code 比较，兼容带/不带连字符番号。
- Rust 新增受限 `read_nfo_text`，只允许 `.nfo` 且限制 10 MB。
- Desktop Private Canonical 写白名单扩大到 works / people / organizations / series / genres / tags / media-files，并增加最小结构校验；写根由 Rust 从当前 Desktop Settings 强制解析，Shared Pack 仍只读。
- Canonical 删除仍不开放，Native delete 仅允许 Private `media-files`；NFO 写入定位为显式确认、fill / merge 的 Bootstrap Ingest。
- Web / Desktop 设置均新增 NFO 元数据目录字段。
- 新增 ADR-031、NFO 导入文档与 V1-16 Manifest。
- 项目、Desktop Workspace、Rust Crate 与 Tauri 配置升级至 0.1.16。

## V1-15 · Desktop Feature Parity I

- Desktop 从 Runtime Console 升级为正式 Localogue 应用壳，新增 Home / Works / People / Media / Packs / Settings。
- 新增 Desktop Work / Person 详情视图与基础关系导航。
- 新增 `TauriLibraryRepository`，按 `Private Library > Shared Packs` 合并 Canonical Entity。
- 抽出 `src/application/library/library-query.ts`，Web `JsonLibraryRepository` 与 Desktop Repository 共用 Works / People 过滤、排序、分页与 self-excluding Facet 规则。
- 旧 `TauriScanRepository` 收敛为兼容薄包装，避免继续维护第二套查询实现。
- Rust 新增 `inspect_shared_pack`，校验 `localogue-pack.json`、schemaVersion、kind、核心 Manifest 字段与 `library/`。
- Desktop Canonical 读取白名单扩展到 works / people / organizations / series / genres / tags / assets；写白名单仍严格只有 Private `media-files`。
- Desktop Media Scan 改用正式合并 Repository，使 Shared Pack Work 可以参与本地媒体番号匹配。
- Media 页面继续支持增量扫描、取消、ffprobe、打开和资源管理器定位。
- Packs 页面显示 Private / Shared 数据源优先级、Manifest 元数据与无效 Pack 错误。
- Settings 页面管理 Private Library、Shared Packs、媒体目录、ffprobe 路径与本机 Web URL。
- 新增 ADR-030、V1-15 实现导读、Manifest，并同步 Desktop Runtime 架构与路线图。
- 项目、Desktop Workspace、Rust Crate 与 Tauri 配置版本升级至 0.1.15。

## V1-13 · Tauri Desktop Alpha

- 新增 pnpm workspace，并创建 `apps/desktop` Tauri 2 + React/Vite Desktop Alpha。
- 保留根 Next.js Web 应用，Desktop 不取代现有 Web。
- 新增 Desktop Runtime Contract 与首批 Tauri FileDialog / FileOpener / MediaProbe Adapter。
- 新增原生 Folder Picker、Media File Picker、默认播放器打开和资源管理器/Finder 定位。
- 新增 Rust Desktop Settings Store，配置写入 Tauri App Config 目录。
- Dev / Release 使用不同 Tauri identifier，隔离 App Config / App Local Data。
- 新增 Rust `probe_media` Command，通过固定参数直接调用 `ffprobe`。
- `ffprobe` 可执行文件名强制限制为 `ffprobe` / `ffprobe.exe`，不向 Webview 暴露通用 Shell。
- 新增 `localogue://desktop-task-progress` Tauri Event，验证 Rust → Webview 的任务进度桥。
- 新增应用级 `desktop-runtime` Permission 与主窗口 Capability。
- Desktop CSP 显式限制为本地资源与 Tauri IPC。
- 新增 `pnpm validate:desktop`，校验 Dev/Release 隔离、CSP、Shell 权限、ffprobe 白名单和 Web/Tauri 分层。
- 新增 `pnpm desktop:doctor`、`desktop:dev`、`desktop:check`、`desktop:build` 等命令。
- 根 `pnpm check` 新增 Desktop Boundary 与 Desktop Webview TypeScript/Vite 校验。
- V1-13 不打包 ffprobe Sidecar；V1-14 再处理 target-triple 二进制、版本和再分发流程。
- `open_web_url` 改用 URL Parser 严格限定 localhost / 127.0.0.1，避免字符串前缀校验绕过。
- `open_path` 当前只允许受支持的视频扩展名，避免桌面“默认打开”能力退化成任意程序执行入口。
- 新增 Desktop 架构、前置环境、V1-13 教材导读与 ADR-027 / ADR-028。
- Desktop Vite Dev Server 明确忽略 `**/src-tauri/**`，避免 Windows 下 Cargo/MSVC 锁定 `target` 内 `.pdb/.dll` 时 Vite watcher 触发 `EBUSY` 并中断 `tauri dev`。

## V1-12 · Platform Abstraction 与增量媒体扫描

- 新增 FileSystem、MediaProbe、FileHash、FileDialog、FileOpener Platform Ports。
- 新增 Node/Web Platform Adapter 与 Runtime Capabilities。
- Media Scan Application Core 移除对 Node fs/path/child_process/crypto 的直接依赖。
- 新增 `pnpm validate:platform` 架构边界校验。
- 媒体扫描升级为 `size + mtime` 增量 Fast Path。
- unchanged 视频不重复执行 ffprobe、完整 SHA-256 或 JSON 写入。
- 文件改变但未成功重新 ffprobe 时标记 `analysisStale`，避免旧技术参数被误认为当前值。
- 文件改变但未重新计算 Hash 时清除旧 SHA-256。
- 自动扫描不会覆盖 `matchMethod=manual` 的人工 Work 绑定。
- 新增 NFO / Poster / Fanart / extrafanart Sidecar Observation。
- Sidecar 变化可单独更新 MediaFile，不触发视频重新分析。
- 新增 MediaScanCoordinator，限制同时只有一个扫描 Job。
- `/api/media/scan` 改为 start / status / cancel 后台任务模型。
- `/media` 新增分阶段 Progress、取消按钮和 added/updated/unchanged/probed/hashed/sidecar 统计。
- 设置页显示 Web Runtime 与 V1-13 Tauri 原生能力差异。
- 新增 ADR-025 / ADR-026、Platform Abstraction、增量扫描教材和 local-javlibrary 参考研究文档。
- 修复 React 19 / eslint-plugin-react-hooks 对媒体扫描初始状态加载的 set-state-in-effect 校验问题，Effect 仅负责调度异步状态同步任务。

## V1-11 · MediaFile 绑定治理与 Portable Pack

- 新增 `/media/[id]`，支持未识别 MediaFile 的候选查看、番号/标题搜索和人工绑定。
- 支持 MediaFile bind / rebind / unbind；人工绑定写入 `matchMethod=manual`。
- 新增 `media-binding-receipts`，保存人工关系修改 before/after，并在 Receipt 写入失败时补偿恢复 MediaFile。
- `validate:audit` 新增 Media Binding Receipt 基础完整性检查。
- 新增 `/packs` Shared / Personal Pack 管理页。
- 新增无第三方压缩依赖的 `.localogue-pack` V1 便携容器：gzip + versioned JSON Envelope。
- Pack 内每个文件记录相对路径、编码、字节数和 SHA-256。
- Personal Pack 支持导出 Canonical JSON、Evidence/History、Presentation Preference、Asset JSON 和 asset-files。
- Personal Pack 故意排除 MediaFile 路径、实例设置和原始视频；导入默认 skip existing，不静默覆盖。
- Shared Pack 支持从当前挂载目录导出便携包，并在另一实例安全安装。
- Shared 安装先进入临时目录，完成文件 Hash 和 Community Validator 后才 rename 到 `.localogue/packs/`。
- 安装成功后自动追加 Shared Pack 路径到实例设置。
- 主项目新增与 `localogue-community-data` V0-01 对齐的 Community Validator。
- Validator 检查 typed UUIDv4、日文 primary name、番号、引用、Source Record 和 Community/Private 数据边界。
- 新增 Portable Pack / Community Data Integration / Media Binding 教材、Schema 与 ADR-023 / ADR-024。

## V1-10 · Asset、Presentation Preference 与本地 MediaFile

- 新增 Private Asset 图片上传与 SHA-256 内容寻址文件存储。
- Asset 增加 subjectType / subjectId，使本地头像/封面无需复制整个 Shared Entity。
- 新增 Presentation Preference 文件化存储，实现人物本地首选头像和作品本地首选封面。
- 人物卡片、人物详情、作品卡片和作品详情统一应用本地显示偏好。
- 新增受控 Asset 内容读取 Route，正确解析 Private / Shared Pack 资源根并防止路径逃逸。
- 上传图片支持 JPEG / PNG / WebP / GIF / AVIF，并拒绝未经清洗的用户 SVG。
- 新增 `/media` 本地媒体文件页面。
- 设置页新增媒体扫描目录和 ffprobe 路径。
- 新增递归视频目录扫描、番号匹配、ffprobe 分析和可选完整 SHA-256。
- MediaFile.workId 改为可选，支持扫描后未识别文件。
- MediaFile 强制只读取 Private Library，Shared Pack 的本地路径数据永远忽略。
- “有本地影片”筛选改为从 MediaFile 反向判断，同时兼容早期 work.mediaFileIds。
- 作品详情展示本地文件大小、真实时长、分辨率、编码和 Hash。
- `validate:data` 新增 Asset subject 与 MediaFile 引用校验。
- `validate:audit` 新增 Presentation Preference 基础完整性检查。
- 新增 Asset/Presentation、MediaFile 私人层、内容寻址、ffprobe 扫描教材与 ADR-021 / ADR-022。
- 修复 Node.js 24 类型定义下媒体 SHA-256 Stream data 回调的 TypeScript 兼容问题。
- 清理 Commit Plan 排除 updatedAt 时产生的 ESLint 未使用变量 warning。


## V1-09 · 设置中心、Shared Pack 与 Local Override

- 新增 `/settings` 实例设置中心，普通用户不再必须编辑 `.env.local` 才能切换私人资料库。
- 新增 Git 忽略的 `.localogue/settings.json` 保存当前机器实例配置。
- 保留 `LOCALOGUE_LIBRARY_PATH` 环境变量，并规定其优先于网页设置。
- 新增 Shared Pack manifest 与只读目录挂载协议。
- 支持在设置页配置多个 Shared Pack，并显示 manifest、版本和有效状态。
- `JsonFileStore` / `JsonLibraryRepository` 支持多根读取和单独私人写根。
- 读取优先级实现为 `Private Library > Shared Packs（配置顺序）`。
- 同一稳定 ID 使用高优先级数据源完整实体，实现 V1 Local Override。
- Demo Library 只在没有任何真实数据源时使用，禁止与真实 Shared Pack 混合 fallback。
- Repository 路径改为延迟解析，网页保存设置后后续请求无需重启进程即可读取新路径。
- Evidence、Lifecycle、Commit Receipt 等私人运行数据开始跟随网页配置的私人 Library。
- CLI `validate:data` 支持按相同优先级合并 Private + Shared 数据。
- CLI `validate:audit` 与 `library:init` 支持读取网页实例设置。
- 新增 Shared Pack manifest JSON Schema 与完全虚构示例 Pack。
- 新增 Community Data、Local Override、设置优先级、共享许可边界及教材文档。
- 新增 ADR-019 / ADR-020 固化配置优先级和 Shared Base 只读原则。
- 补充 Community Data 稳定实体 ID 原则，避免姓名、标题变化导致跨 Pack 身份漂移。
- 补充 Presentation Preference 架构，为 V1-10 的本地头像/封面优先选择预留独立偏好层。
- 补充 Local-First 管理接口安全边界，明确当前 `/settings` 与写操作不应直接暴露到不受信任公网。
- 修正 CLI `.env.local` 加载逻辑：始终尝试加载本地环境文件，同时保留进程环境变量的最高优先级。

## V1-08 · 资料完整度、治理队列与人物手工维护

- 新增 `/curation` 资料治理工作台，集中显示作品/人物完整度、Evidence 队列和重复候选。
- 新增 Work / Person 可解释完整度评分，返回 score、level、checks 与 missingIds。
- Work 完整度明确不因缺少 MediaFile 扣分，继续保持 Work / MediaFile 分离。
- 新增 `/curation/evidence`，支持 pending / ignored Evidence 多选批量治理。
- 批量 Evidence 操作只修改 Lifecycle，并使用 before-state 做失败补偿恢复。
- 新增 `/curation/duplicates`，按精确番号、标题/年份/共同演员、精确人物姓名/别名和出生日期生成重复候选。
- 重复检测只生成 DuplicateCandidate，不自动合并任何 Canonical Entity。
- 新增 `/people/[id]/edit` 人物资料编辑器。
- 支持日文正式名、中文映射、英文/罗马字、旧艺名、别名、状态、生日/出生地、身高三围、三语简介、职业事件等手工维护。
- 人物编辑只允许私人 Library，所有请求在服务端重新校验。
- 新增 PersonEditReceipt，保存手工修改 before/after image 与 changedFields。
- Person Receipt 写入失败时尝试恢复修改前 Person，降低 JSON 多文件半提交风险。
- `pnpm validate:audit` 新增 person-edits 审计记录完整性检查。
- 新增完整度等级和重复候选置信级别中日英受控词表。
- 新增完整度、重复检测、治理队列、人物编辑教材文档及 ADR-017 / ADR-018。

## V1-07 · Provenance、Commit History 与 Snapshot Recovery

- 新增 Work 字段级 append-only Provenance，记录字段采用 Evidence 与 Snapshot Restore 的历史。
- 作品详情页新增 Provenance 区域，可查看当前字段来源、时间和对应 Commit。
- 新增 `/history` Canonical Commit History 与 `/history/[id]` 提交详情页。
- Commit Receipt 升级为 schemaVersion 2，保存完整 operations 与 snapshotId，同时兼容 V1-06 旧 Receipt。
- 每次正式 Commit 前创建最小 Canonical Snapshot，仅保存本次即将触碰的文件 before-image。
- Commit 中途失败时自动尝试恢复 Snapshot，降低 JSON 多文件半提交风险。
- 新增受控 Snapshot Restore；只允许恢复同一 Work 的最新有效 Commit。
- 恢复前检查本次 Commit 创建的新实体是否已被其他 Work 引用，存在引用时阻止恢复。
- 用户主动恢复保留 Commit / Provenance 历史，并新增 Restore Receipt 与 restored Provenance Event。
- 恢复后对应 Evidence 生命周期重新变为 pending，可以重新审核和再次 Commit。
- Evidence 生命周期与 Evidence 本体分离，新增 pending / committed / ignored。
- Evidence Inbox 默认只看待审核项，并支持待审核 / 已归档 / 已忽略 / 全部筛选。
- ignored Evidence 禁止生成 Commit Plan 或正式归档，可随时恢复为 pending。
- 新增 `pnpm validate:audit`，检查 Commit、Snapshot、Restore、Provenance、Lifecycle 与 Evidence 的引用完整性。
- `pnpm check` 增加 Audit 数据校验。
- 新增 Evidence Lifecycle、Provenance Event 中日英受控词表和 V1-07 Schema 示例。
- 新增 Provenance/History 架构、Snapshot Recovery、Evidence 生命周期、教材导读和 ADR-015 / ADR-016。

## V1-06 · Review Decision 与 Canonical Commit

- 新增字段级 `keep_library / use_evidence` 审核决策。
- 新增实体级 `use_match / bind_existing / create_new / skip` 决策。
- ambiguous / unresolved 实体不再提供默认动作，必须人工明确处理。
- 新增 Commit Plan，正式写入前可预览将创建和修改的实体。
- 新增 SHA-256 fingerprint；执行前服务器重新生成计划，拒绝过期 Plan。
- 新增 Canonical Commit API 与 Commit Executor。
- 新增 Person、Organization、Series、Genre、Tag 的 JSON Repository 写入能力。
- Canonical JSON 写入顺序固定为“新依赖实体 → Work → Commit Receipt”。
- 新增 `review-commits` 留痕，Evidence Inbox 可识别已归档记录。
- 默认 Demo Library 明确设为只读；只有配置 `LOCALOGUE_LIBRARY_PATH` 才允许正式归档。
- 新增 `pnpm library:init`，可把 Demo Canonical 数据安全复制到 Git 忽略的私人 Library 用于学习和测试。
- `validate:data` 会读取 `.env.local`，使 CLI 校验与 Next.js 使用同一个 Library。
- 新增 Commit Plan、乐观并发、JSON 写入安全和私人 Library 模式教材文档。
- 新增 ADR-014，规定任何 Canonical 写入必须先经过 Commit Plan 和明确确认。

## V1-05 · Evidence Inbox 与实体匹配审核

- 新增 `/review` Evidence Inbox，集中查看私人资料目录中保存的 Evidence。
- 新增 `/review/[id]` 审核详情页，展示 Raw、Normalized 与 Canonical 三层数据。
- 按规范化番号精确检测 Canonical Library 中是否已有同一 Work。
- 新增保守 Entity Resolution：Person、Maker、Label、Series、Genre、Tag、Work Type 均采用规范化精确匹配。
- Person 匹配覆盖正式名、本地化名、罗马字、旧艺名、曾用名、别名和其他名称。
- 新增 `matched / new / ambiguous / unresolved` 实体解析状态。
- 新增 `same / different / evidence_only / library_only` 字段比较状态。
- 已有 Work 可对照番号、标题、发行日期、时长、简介、人物关系和分类关系。
- 导入成功后可直接进入 Evidence 审核箱。
- 新增已有作品冲突演示文件 `sample-existing-work.json`。
- 新增 Review Analysis、Evidence Inbox、实体匹配教材文档和 ADR-013。
- V1-05 仍不直接修改 Canonical Library，为 V1-06 字段级审核决策保留安全边界。

## V1-04 · Evidence-first 导入基础

- 修复点击“应用筛选”后页面跳回顶部的问题，筛选提交继续使用 URL 但保留当前滚动位置。
- 新增 `/import` 导入工作台。
- 新增 JSON、NFO、CSV、XLSX 四种文件预览。
- 新增粘贴 JSON 直接生成导入预览。
- 建立 Importer Registry、统一 Normalizer 与基础 Validator。
- 预览同时展示 Raw Data、Normalized Data 与解析警告。
- 新增 Evidence Store，确认后写入私人 `data/library/evidence`，不修改正式作品和人物。
- 新增四种虚构导入示例与 V1-04 教材级中文文档。

## V1-03 · 浏览体验与实体详情增强

- 修复作品筛选栏过窄、日期控件和长文本导致横向滚动的问题。
- 海报墙 / 列表 / 表格切换使用 `scroll={false}` 保持当前浏览位置。
- 新增已选筛选条件 Chips，可单项移除或全部清除。
- 新增作品 URL 分页，并在翻页后定位到结果区域。
- 新增人物库高级筛选：姓名/别名、状态、出生年份、出道年份、引退年份、身高范围。
- 新增人物姓名、出生时间、出道时间、身高排序。
- 新增 Maker、Label、Series 详情页与三语名称展示。
- 新增 Maker ↔ Label 关系导航和相关作品预览。
- 补充 V1-03 响应式布局、滚动、分页、人物查询与实体详情教材文档。

## V1-02 · 浏览与多维筛选增强

- 新增 `/browse` 分类浏览总入口。
- 新增 Maker、Label、Series、Genre、导演、Work Type、Tag 独立浏览页。
- 作品库支持海报墙、列表、表格三种视图。
- 人物详情页中的作品列表同步支持三种视图。
- 视图状态进入 URL，并在继续筛选时保持。
- Facet 计数升级为 self-excluding facets，支持更合理的动态计数。
- 新增分类浏览、Facet 算法和多视图实现的教材级中文文档。
- 保持 JSON Repository 与 Domain Query 的边界，为 V2 SQLite 查询实现保留一致语义。

# 变更记录

## V1-14 — 2026-09-02

### 新增

- Desktop 新增 TauriFileSystemAdapter 与 TauriFileHashAdapter；
- Desktop 复用共享 MediaScanCoordinator / scanMediaLibrary，支持增量扫描、进度、结果统计与取消；
- Rust Runtime 新增受限目录遍历、文件状态、SHA-256 与扫描专用 Repository Commands；
- Desktop 可从 Private Library 读取 works，并只向 media-files 私人层原子写入；
- ffprobe 支持用户路径、发行包 resources/bin 和 PATH 的安全解析顺序。

### 调整

- Web / Desktop Instance Settings 统一 libraryPath、sharedPackPaths、mediaScanPaths、ffprobePath 字段语义；
- Desktop Runtime 权限与校验脚本加入 V1-14 扫描边界；
- 项目、Desktop Workspace、Rust Crate 与 Tauri 配置版本升级至 0.1.14。
- 修复 Rust 文件 SHA-256 将哈希器状态直接按 LowerHex 格式化导致的 Cargo E0277；现在先 finalize 摘要再输出十六进制字符串。

### 安全

- Webview 仍不获得通用 shell、任意集合访问或任意文件写入能力；
- Repository Commands 只允许 works / media-files，实体文件名只接受安全稳定 ID；
- 目录扫描不跟随符号链接，最多返回 25000 个相关文件。

## V1-01 — 2026-09-01

### 新增

- 初始化 Next.js 16.3.3 Web 工程；
- 建立 Domain / Application / Infrastructure / UI 分层；
- 建立 `LibraryRepository` 和 `JsonLibraryRepository`；
- 加入 Work、Person、Organization、Series、Asset、MediaFile、Genre、Tag 类型；
- 加入文件化 JSON Canonical Library；
- 加入虚构作品、人物、组织、系列与图片 Demo 数据；
- 实现首页资料统计；
- 实现作品库、作品详情；
- 实现演员库、演员详情；
- 实现人物姓名历史和职业事件时间线展示；
- 实现 UI / Metadata 两套语言偏好；
- 实现日 / 中 / 英元数据回退；
- 实现浅色、深色、跟随系统主题；
- 实现 WorkQuery 的搜索、关系筛选、年份、时长和排序基础；
- 实现基础 Facet Count；
- 补充 V1 学习文档和 Repository 教材。

## V0 — 2026-09-01

### 新增

- 冻结 Localogue 的产品定位和核心边界；
- 确立“资料治理 + 资料探索”双核心；
- 确立 Canonical Library / Evidence / Review 模型；
- 确立 V1 JSON-first、V2 SQLite 的演进路线；
- 建立作品、人物、组织、系列、分类、资源、媒体文件等数据模型；
- 建立作品类型、Genre、人物状态、职业事件、姓名类型、资源类型等受控词表；
- 定义日文原文优先的多语言策略；
- 定义多维筛选、排序、时间线和人物页二次筛选；
- 定义 JSON / CSV / XLSX / NFO 的角色；
- 记录对 MDC-NG、MDCx、mdcx_sqlite、CM Collectors、Amane、mdcx-diy 的参考分析。

- 修复 Next.js Pack 导出 API 在新版 TypeScript / DOM 类型下 `Uint8Array<ArrayBufferLike>` 无法直接作为 `BodyInit` 的兼容问题，导出响应显式转换为标准 `ArrayBuffer`。


### V1-13 Desktop Open 边界

- `open_web_url` 使用 URL Parser 校验，当前只允许 `http://localhost` 与 `http://127.0.0.1`，不能只依赖字符串前缀。
- `open_path` 当前只允许 Localogue 支持的视频扩展名，避免 Webview 将“默认程序打开”能力扩大成打开 `.exe` / 脚本等任意可执行目标。
- `reveal_in_folder` 只负责在系统文件管理器中定位已经存在的路径，不执行目标。
- 通用 Shell execute/spawn 仍不向 Webview 暴露。

- 修复 Vite 8 Desktop Webview 生产构建仍显式使用已弃用 esbuild Minifier 的问题。
- 正式构建改用 Vite 8 默认推荐的 Oxc Minifier，不额外引入 esbuild 兼容依赖。

### V1-13 构建兼容性补充

- Desktop Workspace 显式增加 `esbuild` 开发依赖，用于 Vite 8 在 `build.target=chrome105/safari14.1` 下的兼容性语法转换。
- Desktop 生产压缩继续使用 Oxc；`esbuild` 仅承担 Vite 8 当前仍保留的兼容 Target Transform，不回退到旧的 esbuild Minifier。

### V1-13 Desktop Webview Target 修正

- 修复直接运行 `pnpm check` / `vite build` 时 `TAURI_ENV_PLATFORM` 不存在，Windows 主机被错误回退为 Safari Target 的问题。
- Desktop Vite Config 现在优先使用 Tauri 注入的平台；没有 Tauri 环境变量时根据 Node `process.platform` 推导 Windows / macOS / Linux。
- Windows WebView2 继续使用 `chrome105` Target。
- WebKit Target 从旧 Tauri/Vite 5 示例的 `safari13` 提升为 `safari14.1`，规避 esbuild 0.28 对旧 Safari destructuring compatibility transform 的已知限制。
- `esbuild` 固定为 `0.28.2`；生产压缩继续使用 Oxc，esbuild 仅用于 Vite 当前仍触发的兼容转换路径。
- `validate:desktop` 新增 Host Platform Fallback 与 Webview Target 架构校验，防止后续再次退化。

- 修复 ZIP 覆盖升级无法删除旧 `apps/desktop/vite.config.js`，导致 Vite 继续执行历史 `safari13` 配置的问题。
- Desktop Vite 配置迁移为 `vite.config.mts`，开发和生产构建均通过 `--config` 显式选择。
- 新增 `desktop:clean:legacy`，在 `pnpm check` 开始时清理旧 Vite 配置 emit、旧 `.ts` 配置与 TypeScript build metadata。
- `validate:desktop` 增加 Vite 配置唯一来源和覆盖升级确定性校验。

- 修复 Windows 下 `desktop:doctor` 使用 `execFile` 直接探测 `pnpm` 时无法解析 `pnpm.cmd`，导致已由 pnpm 启动却误报“未找到 pnpm”的问题。Doctor 现在优先从当前 pnpm 进程的 `npm_config_user_agent` 识别版本，并在独立探测时使用 Windows `.cmd` shim。

### V1-13 Desktop Alpha build resource fix
- 补齐 Tauri Desktop 应用图标资源：32x32、128x128、256x256、Windows ICO 与 macOS ICNS。
- `tauri.conf.json` 显式声明 bundle icon 列表，修复 Windows `tauri-build` / `cargo check` 生成 Resource 时缺少 `icons/icon.ico` 的失败。
- `validate:desktop` 增加 Desktop Icon 资源与 Bundle 声明检查，防止后续重新遗漏构建资源。

## V1-27A - Organization & Series Registry Foundation

- 建立 Provider Entity Source Capability Registry。
- 加入首批 JAVBus 稳定 Maker/Label ID 证据与 JAVLibrary 名称证据。
- Series 新增可选 `parentOrganizationId`，补齐 Maker → Label → Series 归属链。
- 新增 `validate:registry` 与 `registry:audit`，并把 Registry Validator 接入 `pnpm check`。
- 不进行基于名称相似度的自动 Organization 合并。
