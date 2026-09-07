# 网页端资料库配置（Library Profile）

网页端自本版本起采用与桌面端一致的 **Library Profile（资料库配置）** 多资料库模型。本文只说明网页端特有的存储、迁移与界面行为；资料库的概念、四种路径含义与隔离语义请见 [桌面端资料库配置与资料源](../desktop/library-profiles-and-sources.md)。

## 为什么网页端也要有 Profile

早期网页端只有单一 `InstanceSettings` 平面字段（`libraryPath` 单路径 + `libraryRoots` + `sharedPackPaths`），完全没有 Profile 概念；而桌面端自 V1-24A 起已是 `LibraryProfile[]` + `activeLibraryProfileId` 的多资料库模型。两边长期漂移，逐渐变成“两个不同应用”。

本改动把 Profile 模型带到网页端，使 Web / Desktop 在资料库层对齐，才能共享同一套资料库状态。

## 数据模型与存储约定

`InstanceSettings` 增加两个字段：

- `libraryProfiles?: LibraryProfile[]`
- `activeLibraryProfileId?: string`

**扁平字段始终镜像当前 Profile**（与桌面端契约一致）：

- 保存设置时，当前的 `libraryPath / libraryRoots / mediaScanPaths / nfoScanPaths / sharedPackPaths` 经 `syncActiveLibraryProfile` 写回当前 Profile；
- 读取时由 `resolveActiveSources` 优先取当前 Profile，回退到扁平字段。

这样所有既有消费者（Shared Pack 挂载、媒体扫描等）无需改动即可享受 Profile 能力，是本次改动低风险的关键。

## 平滑迁移（读取时升级）

旧版单一路径设置会在**读取时**通过 `ensureLibraryProfiles` 自动升级为一个 Profile，升级只发生在内存中，真正写回仍由用户后续保存 / 切换动作完成：

- 若没有任何已配置的资料源，返回空的 `libraryProfiles`，不制造“幽灵 Profile”；
- 若存在旧路径，生成一个固定 ID 的 Profile（示例库路径默认名“示例库”，否则“资料库 1”）并镜像旧字段；
- `activeLibraryProfileId` 缺失或指向不存在的 ID 时，回退到列表第一项。

## 网页端界面

### 设置页 Profile 管理

- 列出全部 Profile，可切换 / 重命名 / 删除；
- 提供新建 Profile 输入框；
- “添加示例库”按钮：复制内置 `data/demo-library` 到 `data/library`，并创建固定名称“示例库”Profile。

### 顶栏切换器（ProfileSwitcher）

- 仅当存在多个 Profile 时显示下拉；
- 切换通过 `POST /api/settings/profile`（`action: switch`）完成，立即持久化。

### API

`POST /api/settings/profile`，`action` ∈ `switch | create | rename | remove | seed-demo`，未知 `action` 返回 400。

## 与桌面端的差异

- 网页端 Private Library 由用户通过 `/settings` 指定路径或 `LOCALOGUE_LIBRARY_PATH` 环境变量决定，**没有**桌面端 Native 自动创建的受控目录；
- 删除 Profile 只移除配置，不删除任何磁盘数据；
- 切换、重命名、新建的持久化语义与桌面端保持一致，其余概念（四种路径、隔离边界、示例库角色）完全相同。

## 关键实现文件

| 文件 | 职责 |
|---|---|
| `src/domain/entities/library-profile.ts` | `LibraryProfile` / `ProfileSettings` 与一组泛型纯函数（`ensureLibraryProfiles` / `syncActiveLibraryProfile` / `resolveActiveSources` 等） |
| `src/domain/entities/instance-settings.ts` | `InstanceSettings` 增加 `libraryProfiles` / `activeLibraryProfileId` |
| `src/infrastructure/settings/instance-settings-store.ts` | 读取即 `ensureLibraryProfiles`，所有消费者自动获得 Profile 能力 |
| `src/infrastructure/repositories/library-path.ts` | 解析核心改用 `resolveActiveSources`，优先当前 Profile、回退扁平字段 |
| `src/application/settings/settings-service.ts` | `switchProfile` / `createProfile` / `renameProfile` / `deleteProfile` / `seedDemoLibrary` |
| `src/app/api/settings/profile/route.ts` | Profile CRUD 的 API 入口 |
| `src/components/settings-form.tsx` | 设置页 Profile 管理 UI |
| `src/components/profile-switcher.tsx` | 顶栏 Profile 下拉切换器 |
| `src/i18n/settings.ts` / `src/i18n/ui.ts` | 三语文案补全 |
