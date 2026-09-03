# MediaFile：媒体文件

MediaFile 表示本地真实的视频或其他主要媒体文件，与 Work 分离。

## 建议字段

- `id`
- `workId`
- `path`
- `filename`
- `fileSize`
- `sha256`
- `durationSeconds`
- `width`
- `height`
- `videoCodec`
- `audioCodec`
- `bitrate`
- `subtitleLanguages`
- `addedAt`
- `lastSeenAt`

## 一个 Work 多个 MediaFile

例如同一作品可能有：

- 1080p 版本；
- 4K 版本；
- 中文字幕版本；
- 分段 CD1 / CD2。

这些不应该生成多个 Work。

## V1

V1 可先只记录路径、存在状态、大小、可选的基础信息。MediaInfo / ffprobe 深度探测属于 V1.x。

## V1-10 已实现字段

- `workId`：可选，允许未识别媒体；
- `path / fileName / extension`；
- `fileSize`；
- `durationSeconds`；
- `width / height`；
- `videoCodec / audioCodec / container`；
- `sha256`：可选，扫描时显式启用；
- `scanRoot`；
- `matchMethod`；
- `fileModifiedAt / analyzedAt`。

MediaFile 只属于 Private Layer，Shared Pack 中的 `media-files/` 不参与读取。

## V1-12 增量扫描字段

新增：

- `analysisStale`：视频文件已经改变，但当前技术参数尚未成功重新分析；
- `sidecars.nfoPaths`：NFO Observation；
- `sidecars.posterPaths`：Poster / Cover Observation；
- `sidecars.fanartPaths`：Fanart / Background / extrafanart Observation。

V1-12 直接复用：

```text
fileSize + fileModifiedAt
```

作为文件变化 Fast Path，因此暂时不再创建一份重复的 ScanIndex JSON。

注意：`sidecars` 是媒体扫描的本地观察，不是 Canonical Work 字段。扫描器不会读取 NFO 后直接改 Work。V1-16 起 NFO 有独立的显式 Bootstrap Import；V1-17 的 Unified Root 也只是统一“发现入口”。本地 poster / fanart / thumb 会通过单独的 Asset Preview / Explicit Import 进入 Asset 治理，长期冲突治理仍回到 Evidence / Review。
