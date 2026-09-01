# Localogue V1-03 交付清单

## 版本主题

**浏览体验、URL 状态与实体详情增强。**

## 用户反馈修复

- [x] 扩大作品筛选栏宽度；
- [x] 修复日期 / Select / 长文本导致的筛选栏横向滚动；
- [x] 小屏筛选字段自动改单列；
- [x] 海报墙 / 列表 / 表格切换保持当前滚动位置。

## 新增功能

- [x] 已选筛选条件 Chips；
- [x] 单个条件快速移除；
- [x] 清除全部筛选；
- [x] 作品 URL 分页；
- [x] 人物列表分页；
- [x] 人物姓名 / 别名 / 旧艺名搜索；
- [x] 人物状态筛选；
- [x] 出生 / 出道 / 引退年份筛选；
- [x] 身高范围筛选；
- [x] 人物多种排序；
- [x] Maker 详情页；
- [x] Label 详情页；
- [x] Series 详情页；
- [x] 三语实体名称展示；
- [x] Maker ↔ Label 关系导航。

## 学习文档

- `docs/development/v1-03-responsive-filter-and-scroll.md`
- `docs/development/v1-03-pagination-walkthrough.md`
- `docs/development/v1-03-person-filtering-walkthrough.md`
- `docs/discovery/active-filter-chips.md`
- `docs/ui/responsive-filters.md`
- `docs/ui/catalog-detail-pages.md`

## 建议本地检查

```bash
pnpm validate:data
pnpm lint
pnpm typecheck
pnpm build
```
