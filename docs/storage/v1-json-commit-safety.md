# V1 JSON 写入安全策略

## 1. JSON 没有数据库事务

SQLite 可以把多个写操作放在一个 Transaction 中：

```sql
BEGIN;
-- 多个 INSERT / UPDATE
COMMIT;
```

失败时可以整体 `ROLLBACK`。

普通 JSON 文件没有这一能力。

## 2. V1 的安全写入顺序

V1-06 使用：

```text
新 Person / Organization / Series / Genre / Tag
                     ↓
                    Work
                     ↓
                Commit Receipt
```

原因：如果中途失败，优先允许产生“尚未被引用的孤立实体”，而避免先产生“引用不存在实体的 Work”。

## 3. 单文件原子写

`JsonFileStore.writeEntity()` 使用：

```text
正式文件.json.tmp
       ↓ write
rename
       ↓
正式文件.json
```

同一文件系统上的 rename 通常是原子的，因此单个 JSON 文件不会轻易处于“只写了一半”的状态。

## 4. V1 的明确局限

V1 仍然不保证多个 JSON 文件构成真正的 ACID Transaction。

因此：

- Commit Plan 尽量减少未知写入；
- 写入顺序保持引用安全；
- 保存 Commit Receipt；
- V2 SQLite 使用真正事务补齐这一能力。
