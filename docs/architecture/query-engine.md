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
