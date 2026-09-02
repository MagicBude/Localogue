# ADR-015：Evidence 生命周期与 Evidence 本体分离

## 状态

已接受。

## 背景

Evidence 表示一次外部输入的原始事实。如果为了标记“已审核”“已忽略”而不断修改 Evidence 文件，就会让来源记录本身失去不可变性。

## 决策

Evidence Raw / Normalized 内容保持不可变。

生命周期单独存储：

```text
evidence-lifecycle/{evidenceId}.json
```

支持 `pending / committed / ignored`。

## 结果

优点：

- 来源记录可长期审计；
- 生命周期可以恢复而不改写 Raw；
- V2 SQLite 可自然映射为 Evidence 表 + Lifecycle/Status 字段或事件表。

代价：

- 查询 Inbox 时需要合并 Evidence 与 lifecycle；
- 需要额外完整性检查。
