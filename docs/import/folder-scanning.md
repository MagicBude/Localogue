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
- NFO 不直接成为 Canonical；
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
