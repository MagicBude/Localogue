# ADR-044：媒体扫描历史属于本机诊断 Receipt

## 状态

已采纳。

## 背景

媒体扫描已经能显示当前任务状态，但任务结束后信息会随页面刷新消失。用户无法回答“上次扫描是否完成、耗时多久、为什么仍有未关联文件”等日常诊断问题。

扫描结果还包含实际扫描根目录和警告。它们描述的是某台电脑的一次运行事实，不是作品、人物或媒体文件的 Canonical 元数据。

## 决策

- 每个进入终态的扫描任务保存一条 `MediaScanHistoryEntry`，内部保留当时的 `MediaScanJobSnapshot`、耗时和记录时间。
- 历史写入 Private Library 的 `media-scan-history/`，通过既有 Private Audit Native Boundary 校验和原子写入。
- 扫描任务 ID 同时构成历史 ID；页面用内存集合避免同一终态被轮询与同步流程重复记录，写入失败则允许重试。
- 媒体页只读取并展示最近 20 条，历史本体不参与 MediaFile 查询、匹配或扫描决策。
- `media-scan-history/` 不进入 Personal Portable Pack。记录可能含本机盘符、目录和网络位置，不适合作为跨设备资料内容。

## 结果

扫描业务仍以 `MediaScanCoordinator` 的实时快照为真相，历史只是不可变的诊断收据。以后迁移 SQLite 时，它可以成为独立的 `media_scan_history` 表，而不需要给 Work 或 MediaFile 增加运行状态字段。

当前 JSON 实现按条目写文件，适合 V1 的低频人工同步。未来若加入定时扫描，应同时设计保留期限、分页和清理策略，不能无限累积小文件。
