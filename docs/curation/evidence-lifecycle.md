# Evidence 生命周期

## 原则：Evidence 本体不可变

一次 Evidence 是“当时外部输入告诉了我们什么”。

审核状态发生变化，不应该重写 Raw / Normalized 内容。

因此生命周期单独存放：

```text
evidence/
  evidence_x.json              原始证据

evidence-lifecycle/
  evidence_x.json              当前业务状态
```

## 状态

```text
pending
  ├─→ committed
  └─→ ignored

ignored
  └─→ pending

committed
  └─→ pending   （只有 Snapshot Restore）
```

### pending

等待审核，可以生成 Commit Plan。

### committed

已经完成 Canonical Commit。不能通过普通 UI 改成 ignored。

### ignored

用户明确暂时不处理。

它不是删除：

- Evidence 文件继续存在；
- Raw 数据继续存在；
- 以后可以恢复为 pending；
- 不允许直接生成正式 Commit。

## 为什么 committed 不能直接改状态

已经归档代表 Canonical Library 已经发生真实修改。

如果只把状态改回 pending，却不恢复 Canonical 数据，会造成 UI 状态与资料库事实不一致。

所以必须从 Commit History 执行 Snapshot Restore。
