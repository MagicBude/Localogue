# V1-19 覆盖包说明

覆盖 V1-18 Hotfix 3 后运行：

```bash
pnpm install
pnpm check
pnpm desktop:rust:check
pnpm desktop:dev
```

重点验收：

1. 首页最近作品出现真实海报；
2. Works 左侧可组合演员、导演、年份、类型、Maker、Label、Series、Genre、Tag、日期、时长、封面、本地媒体筛选；
3. 已选条件可通过 Chips 单独移除；
4. People 可按状态、出生/出道/引退年份、身高与排序筛选；
5. Person Detail 相关作品显示海报，并具备三视图与完整二次 Facet；
6. “浏览”入口可按 Maker / Label / Series / Genre / Director / Work Type / Tag 进入作品。

V1-19 不修改 Canonical Schema；V1-18 Unified Library 与 Native I/O Hotfix 数据兼容。
