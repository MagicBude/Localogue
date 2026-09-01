# V1-01 基础实现导读

## 本批目标

V1-01 不追求一次完成全部 V1，而是先建立不会轻易返工的骨架：

```text
Domain Model
    ↓
Repository Interface
    ↓
JSON Repository
    ↓
Application Service
    ↓
Next.js 页面
```

并用真实可操作的页面验证：

- JSON 能否表达作品和人物；
- 多语言是否能正确回退；
- 人物关系是否能反向查询作品；
- 时长和各种分类是否适合筛选；
- 页面是否可以在未来换 SQLite 而保持结构稳定。

## 为什么暂时不使用 Tailwind

不是 Tailwind 不好，而是当前用户希望通过项目学习网页基础。

V1-01 直接使用 `globals.css`，可以更清楚地看到：

- CSS 变量；
- Grid；
- Flexbox；
- 响应式媒体查询；
- Dark Mode；
- Sticky；
- 卡片与详情页布局。

以后如果样式系统规模变大，再评估 Tailwind 或组件库。

## 为什么暂时不做 Monorepo

Localogue 当前只有一个真正的运行程序：Web。

如果一开始就建立多个 packages，会先引入 workspace、跨包构建、路径依赖等额外知识，而这些暂时没有产品收益。

当前代码仍然通过目录完成清晰分层：

```text
src/
├── domain/
├── application/
├── infrastructure/
├── components/
├── i18n/
├── lib/
└── app/
```

当未来出现 CLI、独立 SDK、共享 Schema 包等真实需求时，再拆 Monorepo。

## 数据为什么全部是虚构的

Demo 数据的目标是验证软件，不是成为真实资料的一部分。

因此 V1-01 的：

- 作品；
- 人物；
- 导演；
- Maker；
- Label；
- Series；

全部采用虚构名称，并用 `DEMO-*` 番号区分。

这样测试代码、截图和公开仓库不会与用户的私人收藏混淆。

## 页面数据流示例

以 `/works` 为例：

```text
URL: /works?person=...&year=2026&durationMin=120
                    │
                    ↓
             parseWorkQuery
                    │
                    ↓
                 WorkQuery
                    │
                    ↓
      JsonLibraryRepository.listWorks
                    │
          ┌─────────┴─────────┐
          ↓                   ↓
       items                facets
          │                   │
          └─────────┬─────────┘
                    ↓
              WorksPage JSX
```

页面本身不写文件读取代码，也不自己实现一套筛选算法。
