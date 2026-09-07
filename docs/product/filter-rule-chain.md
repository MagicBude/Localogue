# 作品浏览器筛选 / 排序规则链（收藏与评分维度）

本页说明 P1-a：把 P1-b 引入的「收藏 / 评分」私人展示偏好，接入作品浏览器的统一 `WorkQuery` 规则链，使其成为可筛选、可排序、可深链的维度。

## 为什么接进规则链

- 收藏与评分本身存于私人展示偏好层 `PresentationPreference`（AGENTS.md V1-10：展示偏好属私人层，不污染 Canonical Work、不进 Shared Pack）。
- 但此前它们只是「卡片 / 详情页上的按钮」，**无法反过来用它们筛选或排序作品**。规则链补上这一环，让「只看收藏」「评分 ≥ 4」成为一等筛选条件。
- 复用既有 `WorkQuery` 契约，不另造一套过滤逻辑；因此 Grid / List / Table / 详情页复用查询、Facet 自排除等既有规则全部延续。

## 新增的查询维度

`src/domain/queries/work-query.ts` 的 `WorkQuery` 增加：

| 字段 | 类型 | 语义 |
| --- | --- | --- |
| `favoriteOnly` | `boolean` | 仅返回已收藏作品（私人层 `favorite === true`） |
| `ratingMin` | `number` | 仅返回评分 ≥ 该值；1–5，越界值由 `parseWorkQuery` 收敛到 1–5 |
| 排序 `rating_desc` / `rating_asc` | `WorkSort` | 按评分降 / 升序；未评分作品视为 0，排序时沉底 / 置顶 |

## 数据从哪里来

收藏与评分是私人层数据，不在 Canonical Library 里。因此：

- `src/infrastructure/presentation/presentation-preference-store.ts` 新增 `listWorkRatings()`，返回 `Map<workId, rating>`；`listFavoriteWorkIds()` 已存在。
- `queryWorks`（`src/application/library/library-query.ts`）新增两个可选入参 `favoriteWorkIds`、`ratingById`，与既有的 `mediaFiles` / `assets` 一样作为「上下文」注入纯函数，保持 Web / Desktop 共用同一查询核心。
- `json-library-repository.listWorks` **只在查询真正用到偏好时才加载**：`favoriteOnly` / `ratingMin` 任一为真，或排序为 `rating_*`，才读偏好文件并注入；纯浏览请求不增加磁盘读取。

## URL 深链保真

- `parseWorkQuery`（`src/lib/search-params.ts`）已读取 `favoriteOnly` / `ratingMin` / `sort=rating_*` 并收敛类型。
- 筛选器（`WorkFilterForm`）与活跃 Chips（`WorkFilterChips`）覆盖新维度；`UrlQueryForm` 提交时收集全部表单字段写回 URL，`WorkFilterChips` 移除单个条件时清除 `page` 回到第 1 页。
- 因此刷新、浏览器前进 / 后退、复制链接均完整还原筛选 + 排序状态。

## 界面

- 筛选器新增一行：「仅看收藏」勾选框 + 「评分至少」下拉（★5 / 4+ / 3+ / 2+ / 1+）。
- 排序下拉新增「评分 ↓ / ↑」。
- 激活「仅看收藏」时会渲染「仅看收藏」Chip，可单独移除。

## 实现文件

| 文件 | 职责 |
| --- | --- |
| `src/domain/queries/work-query.ts` | `WorkQuery` 增 `favoriteOnly` / `ratingMin`；`WorkSort` 增 `rating_desc` / `rating_asc` |
| `src/lib/search-params.ts` | `parseWorkQuery` 读取并收敛新参数；`clampRating` 1–5 |
| `src/application/library/library-query.ts` | `queryWorks` / `matchesWork` / `buildWorkFacets` / `createWorkComparator` 注入并消费偏好上下文 |
| `src/infrastructure/presentation/presentation-preference-store.ts` | 新增 `listWorkRatings()` |
| `src/infrastructure/repositories/json-library-repository.ts` | `listWorks` 按需加载偏好并注入 `queryWorks` |
| `src/components/work-filter-form.tsx` | 新增「仅看收藏」「评分至少」控件与评分排序项 |
| `src/components/work-filter-chips.tsx` | 新增对应活跃 Chip |
| `src/i18n/ui.ts` | 三语 `favoritesOnly` / `ratedAtLeast`（排序复用既有 `rating`） |

## 已知边界

- 桌面端 `tauri-library-repository` 暂未注入偏好上下文（新增参数为可选，调用保持兼容、不报错）；桌面端收藏 / 评分筛选需在桌面库接入偏好读取后启用。网页端已完整可用。
- 收藏 / 评分默认回退到 Git 忽略的 `data/library`；未配置 Private Library 时也可在 demo 模式下验证。
