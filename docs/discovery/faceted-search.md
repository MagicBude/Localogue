# 多维筛选（Faceted Search）

Faceted Search 是 Localogue V1 的一级功能。

## 组合筛选

用户可以同时设置：

```text
演员 = 某人物
年份 = 2025
Maker = 某厂商
Work Type = solo
Genre = 某分类
时长 = 90~150 分钟
有本地文件 = 是
排序 = 发行日期降序
```

## 动态 Facet 计数

在当前查询结果内继续计算可选项数量，例如人物详情页：

```text
年份
2026  18
2025  42
2024  53

类型
单体  249
共演   32
VR     18
```

用户继续选择条件后，计数应随结果集变化。

## URL 状态

筛选应尽量反映在 URL Query 中，以支持刷新、前进后退和复制链接。

## V1-02 实现说明

V1-02 已把 Facet 计数升级为 **self-excluding facets**。计算某一个维度的计数时，会忽略该维度自身已有选择，但保留其它筛选条件。

这样用户即使已经选择某个 Maker、年份或 Genre，仍能看到同一维度其它候选项在当前其它条件下的可用数量。

详细代码讲解见：

- `docs/development/v1-02-faceted-search-walkthrough.md`
