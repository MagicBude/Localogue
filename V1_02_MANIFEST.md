# Localogue V1-02 交付清单

## 版本定位

V1-02 聚焦 **资料探索（Exploration）**：让已经进入 Canonical Library 的数据更容易按关系和分类浏览。

## 新增页面

- `/browse`
- `/makers`
- `/labels`
- `/series`
- `/genres`
- `/directors`
- `/work-types`
- `/tags`

## 新增组件

- `src/components/catalog-link-card.tsx`
- `src/components/catalog-page.tsx`
- `src/components/work-results.tsx`
- `src/components/work-view-switcher.tsx`

## 核心修改

- `JsonLibraryRepository` 的 Facet 计数升级为 self-excluding facets。
- `/works` 支持 `view=grid|list|table`。
- 人物详情中的作品区复用相同三视图。
- `WorkFilterForm` 在非默认视图时通过 hidden input 保留 `view`。
- 顶部导航新增“分类浏览”。
- UI 三语字典增加分类浏览和视图相关文案。

## 新增学习文档

- `docs/development/v1-02-faceted-search-walkthrough.md`
- `docs/development/v1-02-view-modes-walkthrough.md`
- `docs/discovery/catalog-browsing.md`

## 本次离线检查

- `node scripts/validate-library.mjs`：通过。
- 54 个 TypeScript / TSX 文件使用 TypeScript `transpileModule` 做语法转译检查：0 错误。
- 当前执行环境没有项目 `node_modules`，所以完整 `pnpm lint / typecheck / build` 仍以用户本机为准。
