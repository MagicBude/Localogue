# Localogue Current Manifest

## 阶段名称

**V1-24 Foundation Cleanup：Library Profiles / Source Model / Rich Fixture**

当前版本继续保持 `0.1.24`。这一轮不改变 Canonical Domain，而是把 V1-24A 已完成的 Presentation Preference、V1-18 Unified Library 与现有 Desktop Settings 收敛成更适合真实用户长期使用的“多资料库”体验。

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
- Desktop Runtime 公开 `contractRevision=2`；若 Webview 已更新但 Native Runtime 仍旧，Profile 管理会被安全禁用并提示重新启动/重编译，避免旧 Rust Settings Contract 把 Profile 字段丢弃；
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
- 扩充为 29 张生成式 JPEG：每部作品至少一张独立海报、每位人物至少一张头像，6 位 performer 另有独立 Gallery，并继续覆盖多封面 / Presentation Preference；
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

## 安全不变量

1. Library Profile 只保存本机路径配置，不保存或复制 Canonical 数据。
2. Private Library 始终是唯一可写资料层；Shared Pack 永远只读。
3. 切换 Profile 不删除、移动或合并磁盘上的任何资料。
4. Media / NFO / Asset 扫描继续通过 Platform/Application 边界，不向 WebView 开放通用文件系统或 Shell。
5. Presentation Preference 仍只是私人显示选择，不改写 Canonical。
6. Dev Fixture 模板只存虚构/生成式数据；开发脚本操作 `var/dev-fixture-library`，产品“示例库”操作 App Local Data 的独立可写副本，二者都不直接写模板。

## 后续

完成本轮实机验收后继续 **V1-24B：Person Portrait / Gallery Asset Governance**，并在此基础上进一步完善首次启动示例库、Profile 管理体验与 Community Pack 安装入口。

## 版本

`0.1.24`
