# V1-27 媒体扫描历史：从实时状态到可追溯诊断

这份说明帮助初学者理解扫描任务、扫描结果和资料库实体为什么要分开保存。

## 三种数据各自回答什么问题

1. `MediaScanJobSnapshot` 回答“扫描现在进行到哪里”。它由 `MediaScanCoordinator` 管理，运行时会不断变化。
2. `MediaFile` 回答“资料库目前知道哪些本地视频”。它是扫描完成后保留下来的当前状态。
3. `MediaScanHistoryEntry` 回答“某一次扫描发生了什么”。它保存终态快照和耗时，只用于诊断。

如果把扫描进度写进 `MediaFile`，每轮扫描都会污染大量实体；如果只保留实时状态，刷新页面后又失去排错证据。独立 History Receipt 让当前资料与运行历史各守自己的职责。

## 写入流程

媒体页启动 Coordinator 后，用轮询刷新运行快照。状态从 `running / cancelling` 进入 `completed / cancelled / failed` 时，页面调用 Repository 保存历史：

```text
MediaScanCoordinator
        │ 终态快照
        ▼
DesktopMediaPage（编排一次写入）
        │
        ▼
TauriLibraryRepository
        │
        ▼
受限 Native Audit Writer
        │
        ▼
Private Library/media-scan-history/<id>.json
```

React 页面不直接拼路径或写 JSON。Repository 隐藏持久化方式，Native 层再确认集合白名单、实体结构和当前 Private Library 根目录。这与未来换成 SQLite 时仍由 Application / Repository 访问数据的方向一致。

## 为什么写入失败不让扫描失败

扫描结果已经更新 MediaFile 后，历史写入属于后续诊断步骤。若磁盘在这一刻写满，应用会明确提示“扫描完成，但保存历史失败”，同时保留已经完成的扫描结果。把整轮扫描伪装成失败，会让用户误以为 MediaFile 也没有更新。

内存中的 `recordedScanIds` 用于解决两个入口可能同时看到终态的问题：普通轮询和“一键同步并等待”。保存成功后该 ID 本轮不再写；保存失败则移除 ID，允许下一次观察终态时重试。Native 原子写入使用稳定 ID，即使极端情况下重复提交，也只会得到同一条记录。

## 展示与隐私边界

媒体页默认折叠历史区，避免新用户第一次同步时面对过多诊断信息。展开后可查看状态、耗时、发现/新增/更新/未变化/未绑定数量，以及最多 50 条警告。

页面只展示最近 20 次，控制首次读取与渲染成本；底层记录暂不自动删除。历史可能保存本机扫描根和错误路径，因此它只留在当前 Private Library，不随 Personal Portable Pack 导出。

当产品加入自动定时扫描后，需要再补三个能力：按时间分页、可配置保留期限、清理操作的审计记录。当前阶段不提前引入后台数据库任务。
