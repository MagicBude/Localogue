# Localogue V1-17 Manifest

## 版本

- Localogue：`0.1.17`
- Desktop Workspace：`0.1.17`
- Rust Crate / Tauri：`0.1.17`

## 主题

**Unified Library Source & Desktop Interaction Parity II**

V1-17 同时解决两个真实使用问题：

1. 用户可以只添加一个共同父目录，让视频、NFO、poster / cover / fanart / thumb 跨子目录自动发现并按 Work 番号汇聚；
2. Desktop 不再只负责“看资料和扫描”，而是补齐 Private CRUD、核心筛选排序、Shared Pack 管理、元数据关系编辑和 Media ↔ Work 人工治理。

## Unified Library Source

- 实例设置新增 `libraryRoots`，Web / Desktop 使用相同语义；
- Desktop Settings 新增“统一资料源根目录”，原 `mediaScanPaths / nfoScanPaths` 保留为高级兼容路径；
- 目录名零语义：`写真/`、`VR/`、`单体/` 等只是用户分类，是否为媒体只由文件扩展名决定；
- 媒体扫描合并 `libraryRoots + mediaScanPaths`；
- NFO 扫描合并 `libraryRoots + nfoScanPaths`；
- 本地图片扫描合并 Unified Root 与兼容路径，并按规范化路径去重；
- 同番号多 NFO 在 Preview 中聚合为一个 Work Group，例如 `MDVR-195 · 6 sources`；
- 支持 `poster / cover / fanart / background / backdrop / thumb / thumbnail / screenshot`；
- 图片与 NFO / 视频不要求同目录；优先用文件名番号，缺失时可用同 NFO stem 保守匹配；
- 同一次显式导入中先创建/补充 Work，再关联 Local Asset；
- Asset 二进制由 Rust 校验扩展名、大小和 magic bytes 后复制到 Private `asset-files/`；
- Asset 使用 SHA-256 内容寻址，原始用户文件不移动、不删除。

## Desktop Interaction Parity II

### Works

- Desktop Works 支持番号/标题搜索、排序和“有/无本地媒体”筛选；
- 可直接在 Private Library 新建最小 Work；
- Work 详情新增编辑器，可修改番号、标题、简介、发行日期、时长；
- 可编辑 Maker / Label / Series / Genre / Tag；
- 可编辑 performer / director Person Relations；
- Shared Work 保存时创建同 ID Private Override，不修改 Shared Pack；
- Private Work 可删除，但 Rust 会阻止删除仍被 MediaFile / Asset 引用的 Work。
- Work 详情提供 Private Asset “解除 / 删除”入口；只删除 Asset 元数据与 Work 引用，不自动删除原始图片或内容寻址二进制。

### People

- Desktop People 支持名称搜索、状态筛选与排序；
- 可新建 Person；
- 可编辑主名称、状态、出生日期、身高、简介；
- Shared Person 保存时创建 Private Override；
- Private Person 可删除，但 Rust 会阻止删除仍被 Private Work 引用的人物。

### Media ↔ Work

- Media 列表新增“管理绑定”；
- 支持按番号/标题搜索 Work；
- 支持 bind / rebind / unbind；
- 人工绑定统一写 `matchMethod=manual`，后续自动扫描不会覆盖；
- 每次人工绑定写 `media-binding-receipts`；Receipt 写失败时补偿恢复 MediaFile；
- Native Audit Writer 只允许写 `media-binding-receipts`，写根由 Rust 从 Desktop Settings 解析。

### Shared Packs / Library

- Packs 页面支持挂载 Shared Pack；
- 挂载前使用 Rust `inspect_shared_pack` 校验 manifest 与 `library/`；
- 支持调整 Shared Pack 读取优先级；
- 支持卸载路径；
- Private Library 永远高于 Shared Pack；
- Shared Pack Native Boundary 始终只读；
- Settings 继续统一管理 Private Library、Unified Roots、高级媒体/NFO路径、ffprobe 与 Web URL。

## Native 安全边界

- Canonical Writer 不接受 Webview 提供写根，永远写当前 Desktop Settings 指定的 Private Library；
- Writer 白名单：`works / people / organizations / series / genres / tags / assets / media-files`；
- Delete 白名单：`works / people / assets / media-files`；
- Work / Person / Asset 删除执行引用检查；
- Audit Writer 独立白名单，仅允许 `media-binding-receipts`；
- Shared Pack 无写入或删除入口；
- 不开放通用 Shell execute / spawn；
- `open_path` 继续只允许受支持视频扩展名。

## V1-17 完成矩阵

| 用户交互目标 | Desktop V1-17 |
| --- | --- |
| 新建 / 编辑 / 删除核心 Canonical | ✅ Work / Person；删除有 Native 引用保护 |
| 搜索 / 筛选 / 排序 | ✅ Works / People 核心查询 |
| Library 管理 | ✅ Private + Unified Roots + 高级兼容路径 |
| Shared Pack 管理 | ✅ 校验、挂载、排序、卸载 |
| 元数据关联 | ✅ Work ↔ Person / Organization / Series / Genre / Tag |
| 本地媒体与 Work 关联 | ✅ 自动匹配 + bind / rebind / unbind + Receipt |
| NFO / Poster / Fanart / Thumb | ✅ 跨目录发现与 Work 汇聚 |

## 明确留到 V1-18

V1-17 完成的是 Desktop 日常资料管理的交互基线，不宣称所有 Web 治理工作台都已经迁移。以下仍属于 V1-18：

- Evidence Inbox / Review / Commit Plan；
- Curation / Duplicate Queue；
- Canonical History / Snapshot Restore；
- Person Edit Receipt 与更完整字段级审计复用；
- Portable `.localogue-pack` 导入 / 导出 UI；
- Presentation Preference、Native Asset 二进制预览与首选封面/头像完整交互；
- Web 全部高级 Facet 与所有二级实体独立管理页面的逐项审计。

## 本机验收

```bash
pnpm install
pnpm check
pnpm desktop:doctor
pnpm desktop:rust:check
pnpm desktop:dev
```

推荐验收顺序：

1. Settings 只添加一个共同父目录到 Unified Library Roots；
2. Media 扫描 NFO + 图片并显式导入；
3. 再运行媒体扫描确认视频跨子目录自动绑定；
4. Works / People 分别新建、编辑；
5. 在 Work 编辑器修改演员 / Maker / Series / Genre 等关系；
6. 在 Media 中对一个文件执行绑定、重绑、解绑；
7. Packs 中挂载两个 Shared Pack，调整优先级并保存；
8. 尝试编辑 Shared Entity，确认生成 Private Override 而 Shared 文件保持不变。
