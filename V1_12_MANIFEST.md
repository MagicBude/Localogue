# Localogue V1-12 Manifest

## 版本

- Localogue: `0.1.12`
- 阶段：Platform Abstraction + Incremental Media Scan Foundation
- 前置版本：V1-11 Media Binding / Portable Pack
- 新增 npm 依赖：无

## 本次核心目标

V1-12 不直接创建 Tauri 窗口，而是先解决“桌面化前业务代码与平台 API 耦合”的问题，并把 MediaFile 扫描升级为适合长期大库运行的增量模型。

## Platform Abstraction

新增：

- `src/application/platform/platform-ports.ts`
- `src/infrastructure/platform/node-platform-adapters.ts`
- `src/infrastructure/platform/node-platform-provider.ts`
- `/api/platform/capabilities`
- `pnpm validate:platform`

冻结 Ports：

- FileSystemPort
- MediaProbePort
- FileHashPort
- FileDialogPort
- FileOpenerPort

Web 当前继续使用 Node Adapter；原生 Dialog / Open / Reveal 明确标记 unsupported，计划由 V1-13 Tauri Adapter 实现。

## 增量 Media Scan

重构：

- `src/application/media/media-scan-service.ts`
- `src/domain/entities/media-file.ts`
- `schemas/media-file.schema.example.json`

新增规则：

1. `fileSize + fileModifiedAt` 作为 V1 轻量变化指纹；
2. unchanged 视频不重新 ffprobe；
3. unchanged 视频不重新计算已有 SHA-256；
4. unchanged / Sidecar 未变时不重写 MediaFile JSON；
5. 视频改变且不重新 Hash 时，旧 SHA-256 被清除；
6. 视频改变但没有成功重新 ffprobe 时，保留旧技术值并标记 `analysisStale=true`；
7. `matchMethod=manual` 的人工绑定不会被自动番号匹配覆盖；
8. 重叠扫描根目录按标准路径去重；
9. NFO / Poster / Fanart 作为独立 Sidecar Observation；
10. Sidecar 变化不触发视频重新分析。

## Sidecar Observation

`MediaFile.sidecars` 新增：

- `nfoPaths`
- `posterPaths`
- `fanartPaths`

当前识别：

- `.nfo`
- poster / cover / ps
- fanart / background / backdrop / pl
- `extrafanart/`

这些只是 Observation：NFO 后续进入 Evidence，图片后续进入 Asset Candidate；扫描器不会直接覆盖 Canonical Work。

## Background Scan Job

新增：

- `src/domain/entities/media-scan.ts`
- `src/application/media/media-scan-coordinator.ts`
- `src/infrastructure/media/media-scan-runtime.ts`

`/api/media/scan` 现在支持：

- `POST`：启动扫描，返回 202 + Job；
- `GET`：查询当前 Job；
- `DELETE`：取消扫描。

阶段：

- preparing
- discovering
- comparing
- analyzing
- persisting
- pruning
- completed

同一运行时只允许一个 Job，防止重复点击同时启动多轮 ffprobe / Hash。

## UI

更新：

- `/media`
- `/media/[id]`
- `/settings`

新增：

- 扫描阶段进度；
- added / updated / unchanged / probed / hashed / sidecarUpdated / removed 统计；
- Cancel Scan；
- MediaFile stale 技术信息提示；
- NFO / Poster / Fanart Observation 显示；
- Web Runtime Platform Capability 展示。

## 文档 / ADR

新增：

- `docs/architecture/platform-abstraction.md`
- `docs/architecture/incremental-media-scan.md`
- `docs/development/v1-12-platform-and-incremental-scan-walkthrough.md`
- `docs/research/local-javlibrary-reference.md`
- `docs/decisions/ADR-025-platform-ports-before-tauri-shell.md`
- `docs/decisions/ADR-026-snapshot-diff-before-filesystem-watcher.md`

更新：

- README
- PROJECT_STATUS
- CHANGELOG
- AGENTS
- Roadmap
- MediaFile 数据模型
- MediaFile Private Layer
- Folder Scanning
- Media UI
- Schema Index
- Docs / ADR Index

## 真实运行验证

使用实际 `ffmpeg / ffprobe` 生成测试 MP4，并直接执行本次交付的 `scanMediaLibrary`：

### 首次扫描

- discovered: 1
- added: 1
- probed: 1
- hashed: 1

成功读取：

- 320×180
- H.264
- AAC
- 1 second

### 第二次完全不变

- unchanged: 1
- saved: 0
- probed: 0
- hashed: 0

确认增量 Fast Path 生效。

### 只新增 NFO / Poster

- updated: 1
- sidecarUpdated: 1
- probed: 0
- hashed: 0

确认 Sidecar 与视频分析解耦。

### 人工绑定

把 MediaFile 改为 `matchMethod=manual` 后重新扫描，Work 绑定保持不变。

### 视频改变但关闭 Probe / Hash

- updated: 1
- `analysisStale=true`
- 旧 `sha256` 被移除

### Scan Coordinator

- 第二个并发 Start 被拒绝；
- Cancel 能通过 AbortSignal 结束正在发现文件的 Job；
- 最终状态为 `cancelled`。

## 校验

已完成：

- 默认 Canonical Library Validation：通过；
- 默认 Audit Validation：通过；
- Platform Boundary Validation：通过；
- 170 个 TS / TSX 源文件语法检查：0 error（最终打包前会重新统计）；
- Media Scan Backend 严格 TypeScript 子集：通过；
- Media Scan Workbench 严格 TypeScript 子集：通过；
- 实际 MP4 增量扫描回归：通过；
- Coordinator 单例 / Cancel 回归：通过。

完整 `pnpm check` 因交付环境无法联网取得 pnpm / 项目依赖，仍以用户本地 Node 22 + pnpm 11.24.0 的结果为最终准绳。

## 本地 pnpm check 兼容修复

- 修复 `react-hooks/set-state-in-effect`：初始 Media Scan Job 状态加载不再在 Effect 主体中直接调用会更新 React State 的 `loadStatus()`；
- Effect 改为注册零延迟异步任务，并在 cleanup 中清理 timer；
- 保持首次状态加载、完成后 `router.refresh()` 和运行中 800ms 轮询语义不变；
- 不使用 ESLint disable 或 `any` 绕过 React 19 Hooks 规则。

## 下一阶段

V1-13：Tauri Desktop Alpha。

优先实现：

1. `apps/desktop`；
2. Tauri 2 Shell；
3. Native Folder / File Picker；
4. Open / Reveal File；
5. ffprobe Sidecar；
6. Dev / Release AppData 隔离；
7. Scan Progress → Tauri Event；
8. Web 与 Desktop 共享现有 Domain / Application 规则。
