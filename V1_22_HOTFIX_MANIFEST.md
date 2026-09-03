# V1-22 Hotfix Manifest · Desktop Delete Type Sync & Work Media Gallery

## 背景

V1-22 实机 `pnpm check` 暴露两个 TypeScript 错误：

```text
src/platform/tauri-library-repository.ts(...): error TS2345: Argument of type '"genres"' is not assignable to parameter of type 'DesktopDeletableLibraryCollection'.
src/platform/tauri-library-repository.ts(...): error TS2345: Argument of type '"tags"' is not assignable to parameter of type 'DesktopDeletableLibraryCollection'.
```

同时，V1-22 Work Detail 的“左侧图片 + 右侧长信息表”在 Metadata 高度超过图片时会形成明显空白，不适合后续继续增加截图或视频预览图。

## 修复

- `DesktopDeletableLibraryCollection` 增加 `genres` 与 `tags`，与 Rust `delete_library_entity` 的受控删除白名单保持一致；
- Desktop Boundary Validator 同时检查 `works / people / genres / tags / assets / media-files` 删除类型契约；
- Work Detail 改为顶部全宽媒体画廊；
- 当前画廊按 `poster → fanart → screenshot → cover → 其他图片` 排序；
- 只加载当前图片，不一次性通过 IPC 加载所有图片缩略图；
- 支持左右箭头循环切换；
- 支持轻量类型标签直接跳到指定图片；
- 画廊下方使用全宽高密度 Metadata Table；
- Local Asset 管理改为紧凑列表，避免与顶部预览重复占用空间；
- 后续视频预览图 / 截图可继续扩展同一 Gallery，而不需要再次改变详情页信息架构。

## 不变边界

- 不修改 Canonical Schema；
- 不修改 V1-18 Hotfix 3 Native I/O / Unified Library 扫描实现；
- 不修改 Source Genre Catalog / V1-21 Vocabulary Governance 语义；
- Shared Pack 继续保持 Native 强制只读；
- 产品版本保持 `0.1.22`。
