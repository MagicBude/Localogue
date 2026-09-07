# 收藏与作品个人评分（Favorites & Ratings）

自本版本起，作品（Work）支持**收藏（favorite）**与**个人评分（rating 1–5）**。两者都是“我想怎样看”的私人展示偏好，不修改 Canonical Work，也不进入 Shared Pack，符合 V1-10「展示偏好属于私人层」的架构原则。

## 为什么不直接做进 Canonical Work

收藏、评分是典型的“个人观感”，同一作品在不同用户眼里价值不同：

- 写进 Canonical Work 会污染公共事实，且多用户 / 多设备场景下无法区分是谁的偏好；
- 进 Shared Pack 会让“某人的收藏”被别人看到，违背资料库治理边界。

因此本功能复用既有的 `PresentationPreference`（展示偏好）私人层，与“自选封面 / 头像”走同一条路径。

## 数据模型

`PresentationPreference` 在原有 `preferredCoverAssetId / preferredPortraitAssetId` 基础上新增两个字段：

- `favorite?: boolean` —— 是否收藏；仅 `true` 计入收藏列表；
- `rating?: number` —— 个人评分，合法取值 1–5 整数，由 `normalizeRating()` 收敛，越界 / 非数字视为“未评分”。

一个作品一份偏好 JSON（`presentation_<entityType>_<entityId>.json`）。

## 存储约定

写入根使用 `getPrivateRuntimeLibraryPath()`：

- 已配置 Private Library 时，落到该库（与封面偏好同一处）；
- **未配置时回退到 Git 忽略的 `data/library`**，使收藏 / 评分在 demo 模式下也能本地保存，且绝不触碰只读的 `data/demo-library`。

`listFavoriteWorkIds()` 读取整个 `presentation-preferences` 集合，过滤 `entityType === "work" && favorite === true`，供“收藏”页与侧栏计数使用。

## 用户界面

- **作品卡片**：右上角悬浮心形按钮，点击切换收藏（乐观更新 + 回写 API）；已收藏的卡片会通过 `:has()` 获得一抹主题色描边作为视觉提示。
- **侧栏**：新增“收藏”入口，并带实时数量徽标（来自全局 `FavoritesProvider`）。
- **收藏页 `/favorites`**：服务端组件，列出全部已收藏作品；为空时给引导提示。
- **作品详情页**：标题下方提供心形按钮（带文字）与五星评分组件，再次点击当前星级可清除评分。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/presentation/work/{id}` | 读取单条展示偏好，返回 `{ preference }`（`null` 表示无） |
| `PUT` | `/api/presentation/[entityType]/[id]` | 合并保存；`body` 支持 `assetId` / `favorite` / `rating` 任意组合；写入前校验实体存在 |
| `GET` | `/api/presentation/favorites` | 返回 `{ ids: string[] }`，即全部已收藏作品 ID |

`FavoritesProvider`（客户端 Context）在挂载时只调用一次 `/api/presentation/favorites` 拿到全部收藏 ID，卡片只从内存 `Set` 读取，避免 N 次请求。

## 关键实现文件

| 文件 | 职责 |
|---|---|
| `src/domain/entities/presentation-preference.ts` | 实体加 `favorite` / `rating` 字段与 `normalizeRating()` / `RATING_MIN/MAX` |
| `src/infrastructure/presentation/presentation-preference-store.ts` | 改用运行时可写路径；新增 `listFavoriteWorkIds()` |
| `src/app/api/presentation/[entityType]/[id]/route.ts` | GET 读取 + PUT 合并 `favorite` / `rating` |
| `src/app/api/presentation/favorites/route.ts` | 收藏 ID 列表端点 |
| `src/components/favorites-provider.tsx` | 全局收藏状态 Context（一次拉取 + 乐观更新） |
| `src/components/favorite-button.tsx` | 卡片 / 详情两种形态的心形按钮 |
| `src/components/rating-stars.tsx` | 详情页五星评分 |
| `src/app/favorites/page.tsx` | 收藏页（服务端列出已收藏作品） |
| `src/components/side-nav.tsx` | 收藏入口 + 数量徽标 |
| `src/components/work-card.tsx` | 卡片加入收藏按钮 |
| `src/app/works/[id]/page.tsx` | 详情页加入收藏与评分 |
| `src/i18n/ui.ts` / `src/app/globals.css` | 三语文案与样式 |
