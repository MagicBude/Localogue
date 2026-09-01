# V1-02：海报墙、列表、表格三种视图

Localogue 的作品查询结果支持三种显示形式：

| View ID | 中文 | 适合场景 |
| --- | --- | --- |
| `grid` | 海报墙 | 日常浏览、视觉探索 |
| `list` | 列表 | 同时查看封面和较多文本信息 |
| `table` | 表格 | 数据核对、整理、快速扫描字段 |

## 1. 一份数据，三种表现

代码位置：

```text
src/components/work-results.tsx
```

`WorkResults` 收到的是同一组 `WorkCardViewModel[]`。

它不会因为切换成表格就重新读取 JSON，也不会改变 Domain Model。它只决定使用哪一种 HTML 结构展示已有数据。

这体现了一个基本的前端设计原则：

> 数据状态和视觉表现尽量分离。

## 2. 为什么 View 也放在 URL

例如：

```text
/works?year=2026&maker=maker_aurora&view=table
```

这个 URL 完整表达：

- 正在浏览作品库；
- 只看 2026 年；
- 只看指定 Maker；
- 使用表格视图。

因此刷新、复制链接、浏览器前进后退都不会丢失状态。

`WorkViewSwitcher` 只负责替换 `view`，其它查询参数原样保留。

## 3. 为什么筛选表单需要隐藏的 view 字段

HTML GET Form 提交时，只会提交表单内部字段。

如果用户已经在 `table` 视图，然后重新选择 Genre 并点击“应用筛选”，若表单不带 `view=table`，页面就会重新回到默认海报墙。

因此 `WorkFilterForm` 在非默认视图下加入：

```html
<input type="hidden" name="view" value="table" />
```

这是一个很典型的 Web 基础知识点：**URL 状态必须在每一次导航中被有意识地保留。**
