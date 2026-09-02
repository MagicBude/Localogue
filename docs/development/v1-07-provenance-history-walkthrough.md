# 教材：V1-07 从“写文件”到“可审计资料库”

这一阶段很适合学习数据库为什么不仅仅是“把数据存起来”。

## 1. 先看 `commit-executor.ts`

文件：

```text
src/application/review/commit-executor.ts
```

重点看顺序：

```text
createCanonicalSnapshot()
        ↓
save dependency entities
        ↓
save Work
        ↓
append Provenance
        ↓
set Evidence lifecycle
        ↓
save Commit Receipt
```

再看 `catch`：

```text
restoreCanonicalSnapshot(... includeAuditState=true)
```

这是文件系统版本的事务思维。

## 2. 什么是 Audit Log

`review-commits/` 不负责提供当前 Work 数据。

它只记录：

> “某个时间、因为某条 Evidence、执行了哪些正式操作。”

这就是 Audit Log 的基本思想。

## 3. 什么是 Provenance

Audit Log 关心一次操作；Provenance 关心一个字段。

例：

```text
Commit A
- title
- duration
- performers
```

Commit B

```text
- duration
```

你问：

> 当前 duration 从哪里来？

应该查 Provenance，不应该遍历全部历史再自己推断。

## 4. 为什么恢复不能删除历史

成功提交后再恢复，不等于“这次提交从来不存在”。

正确历史是：

```text
提交 A 成功
后来决定恢复 A
恢复成功
```

所以 Commit Receipt 和旧 Provenance 要保留，再增加 Restore Receipt / restored Event。

## 5. 乐观并发与历史恢复的关系

V1-06 的 fingerprint 解决：

> “我确认的 Plan 还是不是当前 Plan？”

V1-07 的 latest-commit 检查解决：

> “我要恢复的历史版本之后，有没有新的正式修改？”

两者都是在防止“基于过期状态做危险写入”。

## 6. 为什么 `validate:audit` 要和 `validate:data` 分开

`validate:data`：

```text
Work → Person 是否存在？
Work → Genre 是否存在？
```

`validate:audit`：

```text
Commit → Snapshot 是否存在？
Lifecycle → Commit 是否存在？
Restore → Snapshot 是否存在？
Provenance → Evidence 是否存在？
```

一个验证业务实体图，一个验证历史审计图。

未来 SQLite 中它们会自然对应不同表之间的外键和约束。

## 7. 建议动手实验

1. 初始化私人 Library；
2. 导入 `sample-existing-work.json`；
3. Commit 128 → 130；
4. 打开作品详情看 Provenance；
5. 打开 `/history` 看 Operations 和 Snapshot；
6. 恢复 Commit；
7. 再看 Work 时长是否回到 128；
8. 再看 Evidence 是否回到 pending；
9. 执行 `pnpm validate:audit`。

这组实验比只阅读代码更容易理解事务和审计。
