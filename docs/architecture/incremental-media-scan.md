# 增量媒体扫描架构

V1-10 的媒体扫描能够工作，但每次扫描都会重新处理已发现视频。随着资料库扩大，ffprobe 与完整文件 SHA-256 会成为主要成本。

V1-12 改为 **Snapshot Diff + Expensive Work on Demand**。

## V1 的轻量 Scan Index

V1 暂时不额外创建一份重复的 Scan Index 数据库，而复用 Private `MediaFile` 已有字段：

- `path`
- `fileSize`
- `fileModifiedAt`
- `analyzedAt`
- `sha256`
- `sidecars`

其中：

```text
fileSize + fileModifiedAt
```

构成视频文件的廉价变化指纹。

进入 V2 SQLite 后，可以将这些字段建立索引或拆成专门的扫描表，而 Application 语义不变。

## 增量判断

### 新文件

```text
磁盘存在
MediaFile 不存在
→ Add
→ 番号匹配
→ 可选 ffprobe
→ 可选 Hash
→ Save
```

### 视频内容改变

```text
size 或 mtime 改变
→ Update
→ 重新 ffprobe（如果开启）
→ 重新 Hash（如果开启）
```

如果视频改变，但本轮关闭/失败 ffprobe：

```text
analysisStale = true
```

旧 SHA-256 不继续保留，因为它已经不能代表当前文件。

### 完全没变化

```text
size 相同
mtime 相同
Sidecar 相同
绑定相同
已有分析满足本轮要求
→ unchanged
→ 不 ffprobe
→ 不 Hash
→ 不重写 JSON
```

## Sidecar Observation

扫描器同时观察：

- `.nfo`
- poster / cover / `ps` 图片
- fanart / background / backdrop / `pl` 图片
- `extrafanart/`

但这里只是 **Observation**：

```text
NFO → 未来 Evidence Candidate
图片 → 未来 Asset Candidate
```

扫描器绝不能直接把 NFO 内容写成 Canonical Work，也不能因为发现 poster 就自动覆盖用户首选封面。 V1-16 的独立 NFO 资料导入属于单独的 Preview -> Explicit Import 流程，不改变这条扫描器边界。

## 为什么 Sidecar 要单独比较

视频没改变，不代表目录没改变。

例如用户后来新增：

```text
ABC-123.mp4      # mtime 不变
ABC-123.nfo      # 新增
ABC-123-poster.jpg
```

V1-12 会只更新 `MediaFile.sidecars`，不会再次读取整个视频。

## 手工绑定优先级

```text
matchMethod = manual
```

代表用户做过明确治理决定。

后续自动扫描只能保留它，不能重新用番号匹配结果覆盖。

自动扫描只管理：

```text
undefined / code
```

## 扫描任务生命周期

V1-12 新增 `MediaScanCoordinator`：

```text
running
  ↓ cancel
cancelling
  ↓
cancelled

running → completed
running → failed
```

同一进程同时只允许一个扫描 Job，避免多个 ffprobe / Hash 任务互相争抢磁盘。

## Progress Phase

- preparing
- discovering
- comparing
- analyzing
- persisting
- pruning
- completed

Web 页面使用轮询；Tauri 后续可以把同一模型映射成 Rust Event。

## Watcher 为什么不是基础真相

文件监听适合作为实时增强，但不能替代 Snapshot Diff：

- 应用关闭期间的变化看不到；
- NAS / USB 断开可能丢事件；
- Watcher 可能失败或重启。

长期设计：

```text
启动 / 手工扫描 → Snapshot Reconcile
运行期间       → Watcher 快速提示
定期            → Reconcile
```
