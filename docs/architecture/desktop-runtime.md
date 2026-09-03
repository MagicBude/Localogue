# Desktop Runtime 架构

## 目标

Localogue 不把 Web “打包成 Desktop”，也不在 Tauri 里重新实现一套业务规则。两个宿主共享 Domain / Application Core，只在平台边界使用不同 Adapter：

```text
                         Domain / Application
                    + shared library-query rules
                         /                 \
                Next.js Web          Tauri Desktop
                    |                     |
             Json Repository       Tauri Repository
                    |                     |
               Node / Server          Rust / OS
```

V1-13 建立首条 Native 纵向链路，V1-14 把完整增量媒体扫描接入 Desktop，V1-15 建立正式产品壳，V1-16 增加独立 NFO Library Ingest，V1-17 再把视频 / NFO / 本地图片统一成可跨子目录发现的 Library Source。

## V1-15 Desktop 产品壳

`apps/desktop/src/App.tsx` 不再是 Runtime Console，而是 Desktop 的正式应用入口，目前提供：

- Home；
- Works；
- Work Detail；
- People；
- Person Detail；
- Media；
- Packs；
- Settings。

这些页面从 V1-15 的浏览壳逐步演进：V1-16 解决独立 NFO 存量迁移，V1-17 增加 Unified Library Root、NFO Work Group、本地 Asset 汇聚，并补齐 Work/Person Private CRUD、核心筛选排序、Shared Pack 管理以及 Media bind/rebind/unbind 审计。Web 的全部高级 Facet、Evidence/Review/Curation/History、字段级冲突治理与 Portable Pack 完整交互继续进入 V1-18。

## 共享查询核心

Web `JsonLibraryRepository` 与 Desktop `TauriLibraryRepository` 都调用：

```text
src/application/library/library-query.ts
```

该模块只依赖 Domain 类型，不依赖：

- `node:fs`；
- `node:path`；
- Tauri API；
- React。

它负责 Works / People 的过滤、排序、分页与 Work Facet 统计。这意味着“同一资料为什么在 Web 与 Desktop 搜索结果不同”不会因为两套查询实现而逐渐漂移。

## Desktop Repository

`TauriLibraryRepository` 实现既有 `LibraryRepository` 接口。

Canonical Entity 读取优先级与 Web 保持一致：

```text
Private Library
  > Shared Pack 1
  > Shared Pack 2
  > ...
```

相同稳定 ID 使用靠前数据源的完整实体，V1 不做隐式字段级深度合并。

Desktop V1-17 可读取：

- works；
- people；
- organizations；
- series；
- genres；
- tags；
- assets。

`media-files` 只从 Private Library 读取，不从 Shared Pack 合并。

## Shared Pack Native 校验

Desktop 设置保存的是 Shared Pack 根目录，而 Repository 实际需要其 `library/` 目录。V1-15 起使用 Rust `inspect_shared_pack` Command，在路径进入读取根前检查：

- `localogue-pack.json` 存在且可解析；
- `schemaVersion === 1`；
- `kind === "shared-library"`；
- `id / name / version` 非空；
- `library/` 目录存在。

无效 Pack 只在 Packs / Settings 页面显示错误，不会进入 Canonical Repository。

## Rust Command 边界

当前 Desktop Runtime 包含以下类别的受限命令：

- Runtime / Settings：`get_runtime_info`、`load_desktop_settings`、`save_desktop_settings`；
- Dialog：`pick_directory`、`pick_media_file`；
- Open / Reveal：`open_path`、`reveal_in_folder`、`open_web_url`；
- Media：`probe_media`；
- FileSystem / Hash：扫描需要的受限目录遍历、文件状态和 SHA-256；
- NFO：受限 `.nfo` 文本读取（单文件上限 10 MB）；
- Local Asset：受限本地图片导入，校验扩展名 / 大小 / magic bytes 后复制到 Private `asset-files/`；
- Repository：`read_library_collection`、Private-only `write_library_entity`、media-only `delete_library_entity`；
- Shared Pack：`inspect_shared_pack`。

所有自定义命令都必须由 `desktop-runtime` Permission 显式授权。

### V1-17：受控 Private Canonical / Asset Writer

V1-17 在 V1-16 NFO Bootstrap 基础上，为用户明确确认的本地 Asset Ingest 扩展受控写能力：

```text
works / people / organizations / series / genres / tags / assets / media-files
```

但它不是“Webview 可指定任意目录的 JSON Writer”。Native `write_library_entity` 不再接受写根目录参数，而是：

```text
Rust load_desktop_settings()
  -> configured Private libraryPath
  -> collection whitelist
  -> minimal entity shape validation
  -> atomic JSON replace
```

因此 Shared Pack 即使已经挂载，也不能借用该 Command 被写入。`assets` 元数据可以写 Private，但二进制必须经过专门的 `import_private_asset_file` 校验并写入内容寻址目录。

删除边界更窄：`delete_library_entity` 在 V1-17 仍只允许 Private `media-files`，Canonical Entity / Asset 删除必须等待完整治理流程。

NFO / Local Asset Bootstrap 也不是完整 Evidence / Review 替代品：扫描必须先 Preview，写入必须由用户明确确认；已有 Work 只能 fill / merge，不静默覆盖核心事实。冲突型修改与完整 Audit 对齐继续进入 V1-18。

## Media Scan

V1-14 已实现：

- `TauriFileSystemAdapter`；
- `TauriFileHashAdapter`；
- `TauriMediaProbeAdapter`；
- `MediaScanCoordinator` / `scanMediaLibrary` 复用；
- 进度、取消、增量 Fast Path 与缺失文件 reconcile。

V1-15 将扫描 Repository 与正式 Desktop Repository 合并。这样 Shared Pack 的 Work 可以参与番号匹配，但扫描结果生成的 MediaFile 仍只写 Private Library。

V1-17 的 Unified Root 不重新实现媒体绑定：NFO 创建 / 补充 Canonical Work 后，再运行同一增量扫描，由既有番号匹配器重新判断 `MediaFile.workId`。本地 poster / fanart / thumb 则通过 Asset Ingest 按相同番号挂到 Work；视频 size / mtime 没变化时不会因此重复 ffprobe / SHA-256。

## 为什么不开放 Shell

媒体工具很容易诱导实现成：

```text
Webview -> shell.execute(userInput)
```

这是错误边界。`probe_media` 在 Rust 中使用固定 ffprobe 参数，且 executable basename 必须为 `ffprobe` 或 `ffprobe.exe`。Webview 没有通用进程执行权限。

## Event 与取消

Rust 仍可通过：

```text
localogue://desktop-task-progress
```

回传 Native Task 状态。完整 Media Scan 的业务状态则由共享 `MediaScanCoordinator` 管理；取消以 Application `AbortSignal` 为真相源，Native IO Promise 返回后继续检查取消状态。

## Settings

Desktop Settings 位于 Tauri App Config；其：

- `libraryPath`；
- `sharedPackPaths`；
- `mediaScanPaths`；
- `nfoScanPaths`；
- `ffprobePath`；
- `webUrl`；

与 Web Instance Settings 保持字段语义一致，但两个运行入口仍各自保存本机配置。

Web 当前使用：

```text
.localogue/settings.json
```

Desktop 使用 Tauri App Config。V1-17 仍不伪装成已经双向同步；未来如果统一，应设计明确迁移方案与单一真相源。

## Open 边界

- `open_web_url` 使用 URL Parser 校验，只允许 `http://localhost` 与 `http://127.0.0.1`；
- `open_path` 只允许 Localogue 支持的视频扩展名；
- `reveal_in_folder` 只负责定位存在的路径，不执行目标；
- 通用 Shell execute/spawn 仍不向 Webview 暴露。
