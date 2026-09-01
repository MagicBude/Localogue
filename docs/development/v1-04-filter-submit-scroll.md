# V1-04：为什么“应用筛选”会跳回页面顶部

## 问题

V1-03 已经给视图切换使用了 Next.js：

```tsx
<Link scroll={false} />
```

因此海报墙 / 列表 / 表格切换可以保留滚动位置。

但“应用筛选”仍然是普通 HTML GET Form：

```html
<form method="get">
```

提交后浏览器进行一次新的导航，默认会从新页面顶部开始显示。

## V1-04 的解决方式

新增：

```text
src/components/url-query-form.tsx
```

它仍使用标准 `FormData` 收集表单：

```text
HTML input
   ↓
FormData
   ↓
URLSearchParams
```

但是最后不让浏览器直接提交，而使用：

```tsx
router.push(url, { scroll: false })
```

因此同时保留了：

- GET Query String；
- 可分享 URL；
- 浏览器前进 / 后退；
- 刷新后筛选状态；
- 当前滚动位置。

## 为什么不直接把所有筛选改成 React state

如果筛选只存在组件 state 中：

```text
刷新 → 丢失
复制 URL → 别人看不到条件
前进 / 后退 → 不自然
```

所以 Localogue 仍坚持：**筛选状态的真相源是 URL，而不是组件内存。**
