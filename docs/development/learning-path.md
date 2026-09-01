# Localogue 学习路线：从网页到数据库

Localogue 不只是一个要完成的软件，也可以作为一套实际项目教材。本文件给出推荐阅读和学习顺序。

## 第一阶段：先理解“网页怎么组成”

阅读：

1. `src/app/layout.tsx`
2. `src/app/page.tsx`
3. `src/components/site-header.tsx`
4. `src/app/globals.css`

先理解四个概念：

- HTML / JSX 描述页面结构；
- CSS 描述页面布局和视觉；
- React Component 把页面拆成可复用部分；
- Next.js App Router 用目录和 `page.tsx` 建立路由。

例如：

```text
src/app/works/page.tsx
```

对应浏览器中的：

```text
/works
```

而：

```text
src/app/works/[id]/page.tsx
```

对应动态页面：

```text
/works/work_demo_001
```

## 第二阶段：理解 TypeScript Domain Model

阅读：

```text
src/domain/entities/
src/domain/value-objects/
```

这里先不要想数据库表。

例如 `Work` 表达的是“Localogue 认为一个作品应该包含什么”，`Person` 表达的是“人物资料是什么”。这叫 Domain Model（领域模型）。

关键思想：

> 先把业务世界描述清楚，再决定数据具体存 JSON、SQLite 还是其他数据库。

## 第三阶段：直接看 JSON

打开：

```text
data/demo-library/works/work_demo_001.json
data/demo-library/people/person_hoshino_mizuki.json
```

然后对照：

```text
src/domain/entities/work.ts
src/domain/entities/person.ts
```

你会看到 JSON 中的数据字段如何对应 TypeScript 类型。

这是 V1 选择 JSON 的重要学习价值。

## 第四阶段：理解 Repository

阅读：

```text
src/domain/repositories/library-repository.ts
src/infrastructure/repositories/json-file-store.ts
src/infrastructure/repositories/json-library-repository.ts
```

需要掌握一个非常重要的区别：

```text
LibraryRepository
```

回答的是：

> 业务层需要资料库提供什么能力？

而：

```text
JsonLibraryRepository
```

回答的是：

> V1 具体怎样通过 JSON 文件实现这些能力？

到 V2 时我们会新增：

```text
SqliteLibraryRepository
```

这时你就会自然理解“数据库替换持久化层”是什么，而不是把 SQLite 当成一个神秘黑盒。

## 第五阶段：理解 Query / 筛选

阅读：

```text
src/domain/queries/work-query.ts
src/lib/search-params.ts
src/infrastructure/repositories/json-library-repository.ts
src/app/works/page.tsx
```

观察这条链：

```text
浏览器 URL
   ↓
searchParams
   ↓
parseWorkQuery()
   ↓
WorkQuery
   ↓
LibraryRepository.listWorks()
   ↓
结果 + Facet
   ↓
React 页面
```

这正是以后 SQLite `WHERE / JOIN / ORDER BY / GROUP BY` 的前身。

## 第六阶段：理解 Server Component 和 Client Component

当前大多数页面是 Server Component。

原因是资料读取发生在服务器端，它们不需要把整个资料库发到浏览器再筛选。

当前典型 Client Component：

```text
src/components/preference-controls.tsx
```

它需要响应浏览器的 `onChange`，所以文件顶部写：

```ts
"use client";
```

先理解这个边界，比一开始把所有组件都写成 Client Component 更重要。

## 第七阶段：进入 SQLite

等 V1 的数据模型和浏览体验稳定后，再开始 V2。

届时重点学习：

- 表（Table）；
- 行（Row）；
- 主键（Primary Key）；
- 外键（Foreign Key）；
- 一对多 / 多对多；
- JOIN；
- INDEX；
- SELECT / WHERE / ORDER BY；
- GROUP BY 与 Facet 统计；
- Transaction；
- Migration。

你会发现这些概念都能在 V1 JSON 结构中找到对应的业务含义，因此学习会自然很多。
