# MediaFile 私人数据层

## 1. MediaFile 不是 Community Work 的一部分

作品的番号、标题、演员属于可以共享的公共元数据；但下面这些信息明显属于某个用户的本地环境：

- `D:\Movies\ABC-123.mp4`；
- 文件大小；
- 本地版本实际时长；
- 视频编码；
- 是否有字幕版；
- 本地文件 SHA-256。

因此 V1-10 正式规定：**MediaFile 只从 Private Library 读取和写入，Shared Pack 中的 media-files 即使存在也被忽略。**

## 2. Work 与 MediaFile 的关联方向

V1-10 以：

```text
MediaFile.workId → Work.id
```

作为主要关系。

不要求为了本地文件去修改 Community Work 的 `mediaFileIds`。旧字段暂时保留用于兼容 V1 早期数据，但不再是“是否拥有影片”的唯一依据。

## 3. 未识别文件是合法状态

`MediaFile.workId` 可以为空。扫描到文件但还没识别番号时，文件仍然可以被记录：

```text
MediaFile
  workId = undefined
  → 待识别
```

以后可以增加手工绑定审核，而不是扫描阶段强行猜测。

## 4. 当前番号匹配

V1-10 使用保守的文件名规范化匹配：

- Unicode NFKC；
- 转大写；
- 去掉非字母数字；
- 将 Work 番号与文件名比较。

只用于生成 `matchMethod=code` 的本地关联。未来更复杂的目录/文件名规则应先产生候选，再进入人工确认。

## 5. V1-12 增量扫描与人工绑定优先级

自动扫描只允许维护自动关系：

```text
matchMethod = code
```

如果用户通过 `/media/[id]` 明确绑定：

```text
matchMethod = manual
```

后续扫描必须保留该 Work 关系，不能重新用文件名番号覆盖人工决策。

媒体技术信息使用 `fileSize + fileModifiedAt` 判断是否需要重新 ffprobe。视频改变但无法重新分析时通过 `analysisStale=true` 暴露不确定性，而不是静默展示旧技术参数。

NFO / Poster / Fanart 作为 `sidecars` 记录在 Private MediaFile 上，仅用于后续 Evidence / Asset Candidate，不改变 Community Work。
