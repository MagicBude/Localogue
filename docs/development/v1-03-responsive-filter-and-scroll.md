# V1-03：筛选栏宽度与视图切换滚动位置

本文解释 V1-03 修复的两个实际 UI 问题：

1. 作品筛选栏太窄，日期、下拉框或长文本把容器撑出横向滚动条；
2. 海报墙 / 列表 / 表格切换后页面回到顶部。

## 1. 为什么 CSS Grid 会出现“明明 width: 100% 还是溢出”

Grid 子项默认存在一个容易忽视的规则：它们的最小尺寸可能受内容的“固有宽度”影响。

例如日期输入框、Select、长文本都可能不愿意继续缩小。即使外层写了：

```css
.field input {
  width: 100%;
}
```

子项仍可能把列撑宽。

V1-03 的处理重点不是简单隐藏滚动条，而是允许 Grid 子项真正收缩：

```css
.field,
.filter-form,
.filter-panel {
  min-width: 0;
}

.field input,
.field select {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.field-row {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
```

`minmax(0, 1fr)` 中的 `0` 很重要：它明确告诉浏览器该列可以缩到比内容固有宽度更小。

同时桌面端筛选栏从约 270px 扩大到 320~350px，小屏幕下日期/时长双列自动改为单列。

## 2. 为什么切换视图会回到顶部

视图按钮本质上是 Next.js 的 `<Link>`：

```text
/works?view=grid
/works?view=list
/works?view=table
```

它们会触发一次客户端导航。Next.js 默认会在导航后调整滚动位置。

但是“切换展示方式”并不是进入另一个内容页面，用户通常希望仍停留在刚才的作品区域。

因此 V1-03 在视图 Link 上显式使用：

```tsx
<Link scroll={false} ... />
```

这告诉 Next.js：

> URL 可以变化，但不要替用户重置当前滚动位置。

## 3. 分页为什么又使用锚点

视图切换和分页的语义不同：

- 切换视图：仍然看同一批结果，应保持精确滚动位置；
- 切换页码：结果内容变化，应把用户带回结果区域顶部。

所以分页链接使用：

```text
/works?...&page=2#work-results
```

这样用户不会回到整张页面顶部，也不会停在旧结果中间，而是回到结果区起点。

## 4. 可以学到什么

这两个小问题分别对应两个常见 Web 基础知识：

- CSS Grid 的 intrinsic size / `min-width: 0`；
- SPA / 客户端路由的滚动行为。

它们看起来只是 UI 小问题，但都是构建成熟网页时非常典型的细节。
