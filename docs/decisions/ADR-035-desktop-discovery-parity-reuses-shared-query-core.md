# ADR-035：Desktop Discovery Parity 复用共享 Query Core

状态：已接受，V1-19。

## 决策

Desktop 不复制 Web 的筛选业务规则，而是继续通过 `TauriLibraryRepository -> queryWorks/queryPeople` 复用平台中立 Application Core。

Desktop 可以使用本地 React state 表达筛选状态；Web 继续使用 URL Query String。二者的“状态载体”不同，但 Domain Query、Facet、自排除计数、排序与分页语义必须一致。

V1-19 将下列浏览能力作为 Desktop 一等功能：

- Work 多维筛选：演员、导演、Maker、Label、Series、Genre、Work Type、Tag、年份、日期、时长、封面、本地媒体；
- 已选筛选 Chips；
- 海报墙 / 列表 / 表格；
- Person 高级筛选：状态、出生/出道/引退年份、身高与排序；
- Person Detail 的相关作品继续使用完整 WorkQuery；
- Maker / Label / Series / Genre / Director / Work Type / Tag 分类索引。

## 原因

用户不应该因为切换 Web/Desktop 得到不同的查询结果；Presentation 可以平台化，Domain Query 不能分叉。

## 非目标

Evidence / Review / Curation / History 与 Portable Pack 的重治理 UI 不属于本 ADR，进入后续治理对齐版本。
