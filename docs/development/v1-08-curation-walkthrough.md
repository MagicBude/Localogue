# V1-08 教材导读：从字段检查到治理队列

## 1. 这一版学习什么？

本阶段把“资料是否完整”从 UI 感觉变成可测试的业务规则：

```text
Domain Entity
    ↓
Completeness Service
    ↓
CompletenessResult
    ↓
Curation Page
```

这正是典型的“业务规则不应该写死在页面里”。

## 2. 为什么 Service 不返回中文？

Service 返回：

```ts
missingIds: ["duration", "cover"]
```

而不是：

```ts
["缺少时长", "缺少封面"]
```

因为 Domain/Application 层不应该绑定展示语言。UI 再根据日/中/英词典翻译这些稳定 ID。

## 3. O(n²) 重复检测为什么 V1 能接受？

当前 JSON Demo/私人小型资料库会遍历实体两两组合：

```text
for each left
  for each right after left
```

复杂度约为 O(n²)。

这对几百/几千实体的教学版可接受，但不是最终大库方案。V2 SQLite 可以先用规范化列、索引和 GROUP BY 缩小候选，再做二次比较。

## 4. 为什么“完整度”不是数据库字段？

因为它是**派生数据**：规则权重调整后，旧分数应该立即跟着变化。如果把分数当真相写进每条 JSON，就会产生缓存失效问题。

V1 因此每次按 Canonical Entity 计算。V2 若因性能缓存，也必须把它视为可重建索引，而不是 Source of Truth。
