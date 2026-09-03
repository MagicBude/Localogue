# Localogue V1-15 Manifest

## 版本

- Localogue：`0.1.15`
- 阶段：Desktop Feature Parity I
- 前置版本：V1-14 Desktop Runtime Integration

## 核心交付

- Desktop 从 Runtime Console 升级为正式 Localogue 应用壳；
- 新增 Home / Works / People / Media / Packs / Settings 六个 Desktop 一级页面；
- 新增 Work / Person 详情视图与基础关系导航；
- 新增 `TauriLibraryRepository`，实现既有 `LibraryRepository`；
- Desktop 按 `Private Library > Shared Pack 1 > Shared Pack 2 > …` 合并 Canonical Entity；
- 抽出 `src/application/library/library-query.ts`，Web 与 Desktop 共用 Works / People 过滤、排序、分页与 Facet 语义；
- 新增 Rust `inspect_shared_pack`，校验 Shared Pack Manifest 与 `library/` 后再加入 Desktop 读取根；
- Desktop Media Scan 改用正式合并 Repository，使 Shared Pack Work 也能参与本地文件番号匹配；
- 保留 V1-14 FileSystem / Hash / ffprobe / Open / Reveal / Incremental Scan 原生能力。

## Desktop V1-15 浏览范围

只读 Canonical 集合：

- `works`
- `people`
- `organizations`
- `series`
- `genres`
- `tags`
- `assets`

Private Layer：

- `media-files`

`media-files` 只从 Private Library 读取，不合并 Shared Pack。

## 安全边界

- Webview 仍没有通用 Shell execute/spawn；
- `read_library_collection` 只允许固定集合白名单；
- `write_library_entity` / `delete_library_entity` 额外经过独立写白名单；
- V1-15 写白名单严格只有 `media-files`；
- Shared Pack 永远只读；
- 无效 Shared Pack 不进入 Repository；
- Canonical Work / Person 等治理写入必须等待 V1-16 接入既有 Commit Plan / Audit / Evidence 规则，不允许通过通用 JSON 写入绕开治理。

## 架构变化

### Shared Library Query Core

新增：

```text
src/application/library/library-query.ts
```

`JsonLibraryRepository` 与 `TauriLibraryRepository` 都调用该纯 Application Core。它不依赖 Node、Tauri 或 React。

### Desktop Repository

新增：

```text
apps/desktop/src/platform/tauri-library-repository.ts
```

旧 `TauriScanRepository` 保留为薄兼容包装，不再维护第二套扫描查询规则。

### Shared Pack Native Inspection

新增 Rust Command：

```text
inspect_shared_pack
```

校验：

- `localogue-pack.json`
- `schemaVersion = 1`
- `kind = shared-library`
- `id / name / version`
- `library/`

## 覆盖升级

本包是完整仓库覆盖包。解压到 Localogue 仓库根目录并覆盖同名文件，然后执行：

```bash
pnpm install
pnpm check
pnpm desktop:doctor
pnpm desktop:rust:check
pnpm desktop:dev
```

## 人工验收重点

1. Home / Works / People 能从 Private Library 浏览；
2. 添加合法 Shared Pack 后其资料能进入 Desktop；
3. Private 与 Shared 同 ID 时 Private 实体优先；
4. Works / People 基础搜索与 Web 查询语义一致；
5. Work / Person 详情可以进行基础关系跳转；
6. Media Scan 仍能正常启动、取消并增量更新；
7. Shared Pack Work 能参与媒体番号匹配；
8. 没有 Private Library 时仍可只读 Shared Pack，但不能写 MediaFile；
9. 无效 Shared Pack 能显示错误且不会进入 Repository；
10. MP4 / MKV ffprobe、打开、定位功能保持正常。

## 本环境校验说明

覆盖包生成环境未提供项目要求的 pnpm 依赖缓存，也未安装 Rust/Cargo，因此无法在此环境执行完整 `pnpm check` / `cargo check`。

已执行的静态/边界校验包括：

- `node scripts/validate-desktop-boundaries.mjs`；
- `node scripts/validate-platform-boundaries.mjs`；
- 修改后的 Desktop TypeScript 使用最小 React/Tauri 类型 Stub 执行 `tsc`；
- Shared Query Core 使用 Demo Library 做 Node Smoke Test；
- Tauri Schema / Manifest JSON 解析检查。

最终发布前以用户本机上述完整命令结果为准。

## 下一阶段

V1-16：Desktop Feature Parity II / Interaction Parity。

重点接入：高级筛选、Canonical 编辑、Evidence/Review/Curation/History、Media Binding、Portable Pack 完整交互、Asset/Presentation Preference，并继续复用既有 Application Service，而不是复制 Next.js/Node 业务实现。
