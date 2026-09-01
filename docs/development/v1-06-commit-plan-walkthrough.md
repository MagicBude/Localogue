# 教材：从 Review 到 Commit Plan

## 1. 本阶段可以学到什么

V1-06 很适合理解以下软件工程概念：

- Command 与 Query 分离；
- Preview / Dry Run；
- 乐观并发控制；
- 事务；
- Referential Integrity；
- Audit Log。

## 2. Query 与 Command

读取 Review Analysis 属于 Query：

```text
读取数据 → 分析 → 返回结果
```

Canonical Commit 属于 Command：

```text
明确意图 → 修改状态
```

Localogue 不允许一个“看起来只是查询”的步骤偷偷执行写入。

## 3. Dry Run

Commit Plan 可以理解成数据库迁移工具中的 dry-run：

```text
如果执行，将会：
1. 创建 Person A
2. 创建 Maker B
3. 更新 Work C 的时长
```

用户先看到计划，再执行。

## 4. fingerprint：文件版乐观并发控制

生成计划时，Localogue 对关键计划内容计算 SHA-256：

```text
plan content
   ↓ SHA-256
fingerprint
```

点击最终确认时，服务器不会相信浏览器保存的旧 Plan，而是：

1. 重新读取 Evidence；
2. 重新读取当前 Library；
3. 重新执行 Entity Resolution；
4. 按相同 Decisions 再生成一次 Plan；
5. 比较 fingerprint。

如果不同：

```text
旧 fingerprint ≠ 新 fingerprint
```

说明计划已经过期，写入被拒绝。

这就是一种简化的 **Optimistic Concurrency Control**。

## 5. 为什么这对 SQLite 很有帮助

未来 SQLite 可以把：

```text
BEGIN TRANSACTION
...
COMMIT
```

与版本字段、唯一约束配合使用。

但“先生成计划、再确认、执行前重新验证”的业务流程仍然可以保持不变。
