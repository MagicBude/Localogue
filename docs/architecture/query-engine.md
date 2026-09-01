# 查询引擎

查询引擎统一服务于：

- `/works` 全局作品库；
- 人物详情页中的作品列表；
- Maker / Label / Series / Genre 详情页中的作品列表；
- 时间线；
- 收藏视图。

## WorkQuery 概念字段

- `personIds`
- `directorIds`
- `makerIds`
- `labelIds`
- `seriesIds`
- `genreIds`
- `workTypeIds`
- `tagIds`
- `releaseYears`
- `releaseFrom`
- `releaseTo`
- `durationMin`
- `durationMax`
- `hasMedia`
- `hasCover`
- `completeness`
- `text`
- `sort`
- `page`

## 关键原则

人物详情页不另写一套查询逻辑，而是在同一个 WorkQuery 上预置 `personIds=[当前人物]`。

## Facet

结果除了作品列表，还应返回当前条件下可继续筛选的 Facet 计数。


## V1-01 当前实现说明

V1-01 已实现基础 Facet Count。当前计数基于“应用全部当前条件后的结果集”，因此它属于第一版可用实现。后续 V1-02 会升级为更典型的 Faceted Navigation：计算某一 Facet 的候选数量时暂时排除该 Facet 自身条件，从而让用户仍能看到其他可切换选项。
