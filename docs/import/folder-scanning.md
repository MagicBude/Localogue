# 文件夹扫描

Localogue 的媒体文件夹扫描默认采用 **Indexed Only / Non-destructive**。

## 扫描内容

V1-12 当前实际观察：

- 常见视频文件；
- `.nfo`；
- cover / poster / `ps`；
- fanart / background / backdrop / `pl`；
- `extrafanart/` 图片；
- 文件名中的可能番号。

字幕与更完整的 Sidecar 类型仍属于后续扩展。

## 默认行为

- 不移动；
- 不重命名；
- 不删除原始媒体；
- 不自动覆盖 Canonical 资料；
- 视频旁 NFO 不会因为“被媒体扫描发现”就直接成为 Canonical；独立 NFO 批量导入见 `docs/import/nfo.md`；
- Poster / Fanart 不直接覆盖 Presentation Preference。

## V1-12 增量扫描

媒体文件使用：

```text
fileSize + fileModifiedAt
```

作为廉价变化指纹。

未变化视频不会重复执行：

- ffprobe；
- 完整 SHA-256；
- MediaFile JSON 写入。

Sidecar Snapshot 独立比较，因此视频不变时新增 NFO / Poster 仍能被发现。

## 扫描结果

视频形成 Private `MediaFile`。

伴随文件形成：

```text
MediaFile.sidecars
```

目前只是 Observation：

- NFO → 后续 Evidence Candidate；
- 图片 → 后续 Asset Candidate。

它们不会绕过 Review / Asset 治理直接修改正式资料。

## 可靠同步模型

未来 Filesystem Watcher 只做实时增强。可靠基线仍然是：

```text
Snapshot → Diff → Reconcile
```

这样应用关闭期间、NAS 断线或 Watcher 丢事件后仍然可以恢复正确状态。


## V1-16：独立 NFO 元数据目录

`mediaScanPaths` 与 `nfoScanPaths` 是两套独立输入。前者负责视频 / MediaFile，后者负责 NFO 元数据预览与显式导入。两棵目录树可以完全不同。NFO 导入 Work 后，再运行媒体增量扫描即可按番号重新绑定既有 MediaFile；视频未变化时仍走增量 fast path。


## V1-17：统一资料源根目录

`libraryRoots` 是首选扫描入口。一个共同父目录下可以把视频、NFO、海报、Fanart、缩略图分别放在不同子目录；Desktop 按文件类型递归发现后再通过作品番号汇聚。

```text
Library Root/
├─ 单体/                -> video / MediaFile
├─ VR/                  -> video / MediaFile
├─ 封面+元数据/         -> NFO + poster/fanart/thumb
└─ 字幕/
```

原 `mediaScanPaths / nfoScanPaths` 不删除，只作为额外根目录兼容“确实在另一块磁盘”的资料。重叠目录最终按规范化文件路径去重。
