# 媒体文件页面

`/media` 是 Private MediaFile 的治理入口。

页面职责：

- 查看本机已登记 MediaFile；
- 查看匹配 Work；
- 显示文件大小、真实时长、分辨率、容器、视频/音频编码和可选 SHA-256；
- 查看 NFO / Poster / Fanart Sidecar Observation；
- 从设置页配置的扫描目录执行增量扫描；
- 查看未识别文件数量。

当前不提供浏览器播放、删除原视频、移动或重命名文件。

## V1-11 人工绑定

媒体表格中的已匹配与未匹配文件都可以进入：

```text
/media/[mediaFileId]
```

未匹配文件不会被扫描器强行猜测。详情页提供候选和手工搜索；真正点击绑定后才修改 `MediaFile.workId`。

`matchMethod=manual` 代表人工治理决定，V1-12 起自动扫描明确禁止覆盖。

## V1-12 增量扫描工作台

`/media` 扫描不再等待一个长 HTTP 请求完成。

流程：

```text
POST /api/media/scan   → 启动 Job
GET /api/media/scan    → 查询进度
DELETE /api/media/scan → 取消 Job
```

阶段：

- preparing；
- discovering；
- comparing；
- analyzing；
- persisting；
- pruning；
- completed。

结果会显示：

- added；
- updated；
- unchanged；
- probed；
- hashed；
- sidecarUpdated；
- removed。

对于没有变化的视频，`unchanged` 应增长，而 `probed / hashed / saved` 不应重复增长。
