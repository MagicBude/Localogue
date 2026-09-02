# V1-08 治理队列

`/curation` 是日常维护入口，不只是统计页。

它把多个“需要用户做决定”的信号汇总为队列：

- Work 完整度不足；
- Person 完整度不足；
- pending Evidence；
- ignored Evidence；
- DuplicateCandidate。

## 为什么不用一个 `needs_review=true` 字段？

因为治理原因可能完全不同：

```text
缺封面
缺时长
缺人物简介
Evidence 待审核
疑似重复
```

如果都压成一个布尔值，无法排序、解释和自动生成修复入口。

因此 V1-08 采用“运行时规则计算队列”，V2 SQLite 再根据规模决定是否缓存聚合结果。
