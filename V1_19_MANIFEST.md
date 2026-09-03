# Localogue V1-19 Manifest

## 阶段

**Desktop Discovery & Presentation Parity**

## 用户可见变化

- 首页“最近作品”直接显示真实 poster / cover；
- Works 对齐 Web 完整多维筛选与已选筛选 Chips；
- People 对齐 Web 人物高级筛选；
- Person Detail 的“相关作品”支持海报、三视图、多维筛选和分页；
- Desktop 新增“浏览”入口：Maker / Label / Series / Genre / Director / Work Type / Tag；
- 人物卡与 Person Detail 在存在 Private portrait Asset 时可直接显示头像。

## Work Facet

- keyword
- performer
- director
- release year / date range
- duration range
- has cover
- has local media
- maker
- label
- series
- work type
- genre
- tag
- sort
- pagination
- active filter chips

## Person Filter

- name / alias / former name
- activity status
- birth year
- debut year
- retirement year
- height min/max
- sort
- pagination

## 复用边界

Web/Desktop 继续共用 `src/application/library/library-query.ts`，Desktop 不新增第二套匹配或 Facet 算法。

## 明确未宣称完成

以下 Web 治理能力仍未完成 Desktop parity：Evidence、Review、Curation、History/Restore、Portable Pack 完整导入导出、Presentation Preference Workbench。后续版本继续处理。
