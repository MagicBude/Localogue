# 分类索引浏览

除了在 `/works` 左侧直接组合筛选外，Localogue 还提供独立的“分类入口”。

V1-02 包含：

- `/makers`：按 Maker 浏览；
- `/labels`：按 Label 浏览；
- `/series`：按 Series 浏览；
- `/genres`：按 Genre 浏览；
- `/directors`：按导演浏览；
- `/work-types`：按 Work Type 浏览；
- `/tags`：按 Tag 浏览；
- `/browse`：以上入口的导航页。

## 为什么需要独立入口

Facet 侧栏适合“我已经在作品库里，继续缩小条件”。

分类索引适合“我想从某个概念开始逛”。

两者解决的是不同的浏览心智，但最终都进入统一的 `/works` 查询系统，例如：

```text
/makers
  ↓ 点击某 Maker
/works?maker=maker_xxx
```

因此分类页面不是另一套资料库，只是同一 Canonical Library 的不同入口。

## V1 的性能说明

当前 JSON Repository 中，分类页为了得到作品数量，会对各实体调用 `listWorks()`。

这样写非常直观，适合 V1 学习和验证产品体验。V2 SQLite 会使用批量聚合查询避免 N+1 统计。
