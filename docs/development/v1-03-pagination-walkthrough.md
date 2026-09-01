# V1-03：URL 分页实现讲解

## 目标

Localogue 的分页需要满足：

- 当前页写进 URL；
- 刷新页面不丢页码；
- 复制 URL 可以直接打开同一页；
- 其它筛选、排序和视图参数全部保留；
- 修改筛选条件后自动回第 1 页；
- 进入下一页后定位到作品结果区，而不是页面最顶部。

## URL 例子

```text
/works?maker=maker_aurora&year=2026&sort=release_desc&page=2#work-results
```

这里：

- `maker`、`year` 是筛选；
- `sort` 是排序；
- `page` 是分页；
- `#work-results` 是浏览器锚点。

## Repository 中的分页

`JsonLibraryRepository.listWorks()` 的顺序是：

```text
读取全部 JSON
→ 筛选
→ 排序
→ 计算 total
→ 计算页码
→ slice 当前页
```

核心思想：**分页必须发生在筛选和排序之后。**

如果先分页再筛选，每页数量和总数都会失真。

V2 SQLite 会把相同语义变成：

```sql
SELECT ...
FROM works
WHERE ...
ORDER BY ...
LIMIT ? OFFSET ?;
```

## 为什么改变筛选时删除 page

假设用户当前处于第 8 页，随后增加一个筛选条件，新结果只有 2 页。

如果继续保留 `page=8`，页面会得到空结果。

因此：

- 筛选 Form 本身不提交旧 page；
- 移除 Filter Chip 时主动删除 page；
- Repository 还会把非法过大的页码钳制到最后一页。

这是三层防护。

## 相关代码

- `src/components/pagination.tsx`
- `src/domain/queries/work-query.ts`
- `src/infrastructure/repositories/json-library-repository.ts`
- `src/app/works/page.tsx`
