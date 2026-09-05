# Localogue Current Manifest

## 阶段名称

**V1-25C：Provider ID Identity / Coverage Round 2**

当前产品版本继续为 `0.1.25`。V1-25A/B 已建立 Canonical Vocabulary 与 Provider Coverage；V1-25C 暂不进入 Onboarding，先修复 Provider ID 身份归属，再继续扩充可复核分类。


## V1-25C Provider Identity / Coverage

- Canonical Genre：359；
- Canonical Work Type：43；
- Source-only Classification：51；
- Classification Term Alias：1166（1131 approved / 35 review-required）；
- Community Classification Crosswalk：323 / 323；
- `主観 -> pov`、`ハメ撮り -> pov_recording` 分离；
- Runtime Classification Normalizer / Genre Localization 改为数据驱动；
- 新增 `validate:vocabulary` 与 `vocabulary:coverage`；
- 新增 `provider-genre-catalogs/`、`vocabulary:provider-coverage` 与 `validate:provider-coverage`；
- FANZA 260 / JAVLibrary 286 / JAVBus 9 / JAVDB 32 个当前可信来源词均为 100% 已识别（Review 可存在，Unmapped / Runtime Ambiguous 为 0）；
- Approved Genre Source Alias：72 条；`idSource` 与 `sources` 分离，旧未归属 ID 标记 `legacy-unscoped`；
- JAVBus 只保留 9 条公开页面/API/文档可复核 ID；JAVLibrary 保留 286 label 且只保留独立核实 ID；JAVDB 32 条明确属于 legacy Web Filter namespace；
- 未识别或多义词不猜测，不自动创建 Canonical。

## 本阶段完成

### Library Profile / 多资料库快速切换

- Desktop 新增 `Library Profile` 路径预设层；
- 一个 Profile 保存：Private Library、Unified Library Roots、额外 Media Roots、额外 NFO / 图片 Roots、Shared Pack Paths；
- `ffprobe` 与 Web URL 等运行环境配置保持全局，不随资料库切换；
- 示例库与用户自建资料库可以各自拥有独立路径组合；
- Dev Fixture 固定短名称“示例库”；普通新建 Profile 使用“资料库 N”中性命名，不写死内容分类；
- 侧栏提供当前资料库下拉，可从任意主页面快速切换；
- Profile 切换只切换 Settings 中的路径集合，不复制、不移动、不合并磁盘资料；
- Settings Schema 继续保持 `schemaVersion=1`，新字段为向后兼容的可选扩展；
- Rust Native Boundary 对 Profile 数量、ID、名称与路径进行规范化和安全校验；
- Profile 管理动作立即持久化，`activeLibraryProfileId` 缺失/失效时 TypeScript 与 Rust 都回退到现有首个 Profile；
- 已有 Profile 列表成为事实源，兼容平面路径不再在 active ID 异常时二次创建“幽灵 Profile”；
- “添加示例库”由 Native Runtime 从 Tauri 内置资源复制到 App Local Data，可直接一键使用，不要求普通用户执行 pnpm。
- 示例库刷新使用模板目录内容 SHA-256 签名；Debug Runtime 优先读取当前仓库 `examples/`，避免 `tauri dev` 的旧 `$RESOURCE` 副本让新增 Gallery/JSON 无法下发。
- Desktop Runtime 公开 `contractRevision=5`；若 Webview 已更新但 Native Runtime 仍旧，Profile 管理会被安全禁用并提示重新启动/重编译，避免旧 Rust Settings Contract 把 Profile 字段丢弃；
- Profile 重命名等 metadata mutation 直接持久化完整 Profile 状态，不再被 active path snapshot 二次覆盖。

### 资料源设置收敛

Desktop 设置页将资料源解释为四层：

1. **私人资料库（可写）**：Canonical、Audit、Presentation、MediaFile 等私人真相；
2. **内容根目录（推荐）**：视频、NFO、poster / cover / fanart / thumb 的统一递归发现入口；
3. **只读共享资料**：Community Data / Shared Pack，只参与读取与优先级合并；
4. **高级兼容目录**：确有分散旧目录时才使用的额外 Media 与 NFO / 图片路径。

高级兼容目录默认折叠，普通用户优先只需要理解前三层。新增 `docs/desktop/library-profiles-and-sources.md` 与 ADR-040 固化这套语义。

### Multi-root Unified Sync 修复

- `MediaScanCoordinator` 新增可等待当前 Job 真正结束的 `waitForCompletion()`；
- “同步资料库”在 NFO → Asset 完成后，会等待 **全部** Unified Root + 额外 Media Root 扫描完毕再报告成功；
- 修复配置多个额外媒体目录时，一键同步看起来只处理第一个目录、随后手工媒体扫描才出现其它目录的体验不一致；
- 扫描结果显示实际扫描目录数量和完整目录列表；
- 单独“仅扫描视频”仍保留异步进度与取消能力。

### Desktop Bundle 拆分

- Vite / Rolldown 增加真实 vendor code splitting；
- React 与其它第三方依赖进入稳定 vendor group，避免 Desktop 主入口长期膨胀为单个 >500 KiB chunk；
- 不通过单纯调大 `chunkSizeWarningLimit` 隐藏警告。

### Rich Dev / Showcase Fixture

- `examples/dev-library/template/` 从 3 Works / 2 People 扩充到 **11 Works / 8 People**；
- 扩充为 43 张生成式 JPEG：每部作品至少一张独立海报和横版 Work Gallery、每位人物至少一张头像，6 位 performer 另有独立 Gallery；`DEMO-002` 额外提供 4 张横版 Gallery 用于多图轮播测试，并继续覆盖多封面 / Presentation Preference；
- `LX-*` 用于多图 Presentation 测试，`DEMO-*` 用于人物关系、厂商、厂牌、系列、题材、标签与筛选测试；所有示例 Work / Person 均有生成式视觉素材；
- 恢复 `DEMO-IMPORT-001` JSON 与 `DEMO-IMPORT-002` NFO 兼容导入示例，同时保留新的 LX Review 示例；
- Fixture Validator 增加最小规模、旧 Demo identity parity、Profile 示例与 companion examples 校验；Web `settings.example.json` 与 Desktop `desktop-settings.example.json` 分离，避免 Desktop-only Profile 字段破坏 Instance Settings Schema；
- Example Library 的长期定位升级为“开发 Fixture + 手工验收 + 未来 E2E + 新用户功能展示库”。

### Community Data 接入方向

- `localogue-community-data` 继续作为独立仓库维护公共事实型元数据；
- Localogue 主仓库保存程序、Schema、词表、文档与虚构 Fixture，不复制真实社区资料成为第二份真相；
- 当前直接以 Shared Pack 挂载社区仓库；
- Library Profile 可以为不同资料库保存不同 Shared Pack 组合；
- 后续优先建设 Community Pack Registry / 一键安装与更新，而不是把两个仓库合并。

### V1-24B Gallery / Presentation 回归修复

- 真实 Local Asset 的历史记录可能没有 `width / height`；Hero Gallery 不再因此直接过滤 fanart / gallery / screenshot，而是在 `DesktopAssetImage` 实际加载后用 `naturalWidth / naturalHeight` 验证横版比例；
- `poster` 仍明确禁止进入顶部 Hero Gallery；未知尺寸的 `cover` 也继续保守排除，避免竖版封面重新撑坏横向画廊；
- Work 的私人显示首图候选统一扩展为 `poster / cover / gallery / fanart / screenshot`，默认回退仍优先 `poster → cover`，只有显式私人偏好才会覆盖默认；
- Web Presentation API / Workbench 与 Desktop Resolver 同步相同候选语义，避免同一 `presentation-preferences` 在两个入口表现不同。

### V1-24C Portable Pack / Example Shared 收尾

- 示例库 provision 同时复制 Private Fixture 与 Starter Shared Pack 到 App Local Data；旧 `Private + 0 Shared` 示例 Profile 自动修复为 `Private + 1 Shared`，普通自建 Profile 不自动挂共享资料；
- Personal Backup 明确只备份当前 Profile 对应的 Private Library 内容，不包含 Profile 路径、实例设置、视频媒体或 Shared Pack；
- Personal Import 增加 Native Import Plan，区分新增 / 完全相同 / 内容冲突，并按 Canonical / Asset Metadata / Asset Files / Presentation / Audit 分类；
- 冲突文件默认安全跳过，不覆盖目标 Private Library；导入结果返回结构化分类统计；
- 导入前检查 Asset JSON 与二进制的存在/摘要一致性以及 Preference 外部 Asset 引用，导入后重新检查 Asset Storage Health；
- Native 写入继续使用 Portable 目录白名单，并拒绝目标路径树中的 symlink / Windows Reparse Point；Shared Pack 仍临时目录校验后原子安装且保持只读；
- 新增 `docs/desktop/portable-pack-and-profile-backup.md` 固化多 Profile 时代的备份/迁移语义。

## 安全不变量

1. Library Profile 只保存本机路径配置，不保存或复制 Canonical 数据。
2. Private Library 始终是唯一可写资料层；Shared Pack 永远只读。
3. 切换 Profile 不删除、移动或合并磁盘上的任何资料。
4. Media / NFO / Asset 扫描继续通过 Platform/Application 边界，不向 WebView 开放通用文件系统或 Shell。
5. Presentation Preference 仍只是私人显示选择，不改写 Canonical。
6. Dev Fixture 模板只存虚构/生成式数据；开发脚本操作 `var/dev-fixture-library`，产品“示例库”操作 App Local Data 的独立可写副本，二者都不直接写模板。

## 后续

### V1-24B Asset Governance

- 11 部示例 Work 均同时拥有 poster/cover 与宽幅 Gallery Asset；Work Detail 顶部只展示横版 Gallery/Fanart/Screenshot/横版 Cover，poster 不进入 Hero Gallery。
- Person Detail 提供 Portrait / Gallery 浏览与 Private Asset 管理；受限 Native Image Picker 把导入图片写入当前 Private Library 的 content-addressed `asset-files/`。
- 删除人物图片会先解除 Private Person 引用，并继续受 Presentation Preference 与 Shared Pack 只读边界保护。
- `DesktopAssetImage` 通过 `read_resolved_asset_bytes` 按 `Private > Shared Pack` 优先级解析 Asset 来源；Native 强制 `Asset.id + storagePath` 与最高优先级来源一致，每个来源只能读取自己的 `asset-files/`。
- Media 页新增 Private Asset Storage Health：报告孤儿二进制、缺失文件与非托管引用；安全清理只删除当前 Private `asset-files/` 内、最新 Asset JSON 已无引用的普通文件，不触碰 Shared Pack。
- Dev Fixture 新增 `desktop:demo:orphan`，Rust 新增清理单元测试；Native Runtime Contract 升至 revision 4。

### V1-24C Portable Pack Closeout

- 当前 Profile 的 Personal Backup / Import Plan、冲突跳过、结构化导入结果与 Asset / Presentation 完整性检查已收口；
- 示例库会稳定 provision `Private + 1 Shared`，普通资料库默认保持 `Private + 0 Shared`；
- Native Runtime Contract 当前为 revision 5。

### 下一阶段

继续 Provider Coverage，而不是立刻回 Onboarding：优先取得 JAVDB `/api/v2/tags?type=0..4`、JAVBus 完整 Genre ID、FANZA `GenreSearch` 的可复核 ID 级导出，再比较 JAVLibrary 2024/2025 快照。Provider Coverage 稳定后再回 Community Pack Registry / Onboarding。

## 版本

`0.1.25`

- Starter Shared Pack 现在包含 Shared-only Person `person_shared_demo_001`、Shared-only Work `work_shared_demo_hana_001` 与对应只读 Poster；人物库可直接显示“共享示例花”。

- V1-24C Portable Import Target Lock：Import Plan 绑定预览时 Private Library；Profile 切换后 Webview + Native 双层拒绝旧预览写入；Native Contract revision 6。
