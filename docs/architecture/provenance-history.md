# Provenance、Commit History 与恢复架构

V1-07 把 Localogue 从“能安全写 JSON”推进到“能解释写入、查看历史、受控恢复”。

## 一、三个概念不要混在一起

### Canonical Library

回答：**现在正式资料是什么？**

例如当前 Work 的 `durationMinutes = 130`。

### Provenance

回答：**为什么现在是 130？这个字段从哪里来？**

例如：

```text
时长 130
← Evidence: sample-existing-work.json
← Commit: commit_2026-...
← 2026-09-02 00:20
```

### Commit History

回答：**某次人工审核最终做了哪些正式变更？**

它保存完整 Commit Receipt、操作摘要和 Snapshot 引用。

三者分别是“当前状态 / 字段来源 / 操作历史”，不能互相替代。

## 二、V1-07 数据流

```text
Evidence
  ↓
Review Decisions
  ↓
Commit Plan + fingerprint
  ↓
Canonical Snapshot（before-image）
  ↓
依赖实体 → Work
  ↓
Field Provenance
  ↓
Evidence Lifecycle = committed
  ↓
Commit Receipt
```

任何正式写入前都先创建 Snapshot。

如果执行中途失败：

```text
失败
 ↓
自动恢复 Snapshot（包含审计状态）
 ↓
本次 Commit 视为没有成功发生
```

如果用户以后主动撤销一次成功 Commit：

```text
Commit History
 ↓
恢复资格检查
 ↓
恢复 Snapshot（不倒回 Provenance 历史）
 ↓
追加 restored Provenance Event
 ↓
Evidence Lifecycle = pending
 ↓
Restore Receipt
```

自动失败回滚和用户主动历史恢复的语义不同，因此 Provenance 的处理也不同。

## 三、为什么 Provenance 必须追加而不是覆盖

假设时长经历：

```text
128 ← NFO
130 ← JSON
128 ← Snapshot Restore
```

如果 Provenance 只保存“当前来源”，第二次修改就会覆盖第一次历史。

Localogue 使用事件流：

```text
adopted 128
adopted 130
restored 128
```

最新事件解释当前值，旧事件解释演变历史。

## 四、Commit Receipt 为什么升级到 schemaVersion 2

V1-06 Receipt 只保存：

- Evidence ID；
- Work ID；
- fingerprint；
- 操作数量。

V1-07 额外保存：

- `operations`：当时真正计划执行的操作；
- `snapshotId`：提交前最小快照。

旧 V1-06 Receipt 仍然可以浏览，只是显示为“旧提交 · 无快照”，不能恢复。

## 五、恢复为什么只能处理最新有效 Commit

假设：

```text
Commit A: 128 → 130
Commit B: 130 → 135
```

直接恢复 A 会得到 128，同时把 B 的新修改一起抹掉。

因此只能：

```text
先恢复 B: 135 → 130
再恢复 A: 130 → 128
```

这是一条重要不变量。

## 六、为什么还要检查跨作品引用

某次 Commit 创建了一个新 Person，后来另一个 Work 绑定了这个 Person。

如果恢复第一条 Commit 时直接删除 Person，第二个 Work 就会出现断引用。

所以 Restore Service 会检查：

- 本次 Commit 创建了哪些新实体；
- 这些实体现在是否被其它 Work 使用。

存在引用则阻止恢复。

## 七、V2 SQLite 会怎么变化

V1 JSON：

```text
Snapshot + 顺序写入 + 自动恢复
```

V2 SQLite：

```sql
BEGIN TRANSACTION;
-- INSERT / UPDATE
COMMIT;
-- 失败则 ROLLBACK
```

但 Provenance、Commit Receipt、Evidence Lifecycle 的业务意义不会消失。数据库事务解决“原子写入”，审计模型仍然解决“为什么”和“发生过什么”。
