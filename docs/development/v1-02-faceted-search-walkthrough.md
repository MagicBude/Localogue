# V1-02：Faceted Search 实现讲解

本文解释 Localogue V1-02 为什么要改造 Facet 计数，以及代码是如何工作的。

## 1. 普通筛选和 Facet 的区别

普通筛选只回答一个问题：**哪些作品符合当前条件？**

Facet 还要回答第二个问题：**如果继续选择某个分类，还剩多少作品？**

例如当前条件为：

- 年份：2026；
- 作品类型：单体；
- Maker：尚未选择。

Maker 区域不应该只展示一个静态列表，而应该显示在“2026 + 单体”这个前提下，每个 Maker 分别还有多少作品。

## 2. 为什么不能直接对最终结果计数

假设用户已经选择 `maker_a`。如果我们先把所有条件都过滤完，再统计 Maker，那么结果集中天然只剩 `maker_a`。

这样其它 Maker 会全部消失，用户很难切换条件。

因此 Localogue 使用 **self-excluding facets**：

> 计算某个 Facet 时，暂时忽略该 Facet 自身的筛选条件，但继续保留其它条件。

例如计算 Maker：

```text
当前 Query
├── year = 2026          保留
├── workType = solo     保留
├── maker = maker_a     暂时忽略
└── genre = drama       保留
```

然后再统计各 Maker 的数量。

## 3. 代码位置

核心实现：

```text
src/infrastructure/repositories/json-library-repository.ts
```

`buildWorkFacets()` 内部的 `facetWorks()` 会克隆当前 `WorkQuery`，删除指定维度，再使用同一个 `matchesWork()` 重新匹配。

这很重要，因为：

- 筛选规则只有一套；
- 不会出现“结果列表一套判断、Facet 又一套判断”；
- V2 换 SQLite 后，可以把同样的语义翻译为 SQL。

## 4. 为什么 V1 可以这样算

JSON 版会多次遍历内存中的 Work 数组。对 V1 的几千到几万条个人资料规模，这是很容易理解也足够实用的实现。

V2 SQLite 不会机械照搬循环，而会把 Facet 统计下推给数据库，例如使用：

```sql
GROUP BY
COUNT(*)
```

所以当前代码优先保证**语义正确和容易学习**，而不是提前做数据库级优化。
