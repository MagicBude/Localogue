# Provenance：字段来源追踪

Provenance 回答两个长期问题：

1. 当前正式字段从哪里来？
2. 为什么它最终选择了这个值？

## V1-07 实现

每个 Work 对应一个追加式日志：

```text
provenance/{workId}.json
```

结构概念：

```text
WorkProvenanceLog
└── events[]
    ├── field
    ├── eventType
    ├── evidenceId
    ├── sourceType
    ├── sourceName
    ├── commitId
    ├── restoreReceiptId
    ├── recordedAt
    └── value
```

## 字段粒度

当前支持与 Review 字段保持一致：

- `code`
- `title`
- `releaseDate`
- `durationMinutes`
- `description`
- `performers`
- `directors`
- `maker`
- `label`
- `series`
- `genres`
- `tags`
- `workTypes`

保持同一稳定字段 ID 的好处是：Review、Commit、Provenance、未来 SQLite 都不需要重复发明字段名。

## Event，而不是“当前来源”

例：

```text
2026-09-02 adopted  durationMinutes=130  ← Evidence A
2026-09-03 adopted  durationMinutes=125  ← Evidence B
2026-09-04 restored durationMinutes=130  ← Restore B
```

当前值由最后一条事件解释，同时旧来源历史不会丢失。

## Provenance 与 Evidence

Evidence 是完整来源记录；Provenance 只保存指针和被采用后的字段值。

不要把完整 Raw Payload 再复制进 Provenance。

## Provenance 与 Commit Receipt

- Receipt：一次 Commit 做了什么；
- Provenance：一个字段经历了什么。

两个视角互补。

## V2 SQLite 映射方向

未来可以自然形成：

```text
field_provenance_events
- id
- work_id
- field
- event_type
- evidence_id
- commit_id
- recorded_at
- value_json
```

并为 `(work_id, field, recorded_at)` 建索引，快速获得字段当前来源和历史。
