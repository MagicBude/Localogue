# 教材：JSON Repository 是怎样工作的

## 1. Repository 解决什么问题

如果页面直接：

```ts
readFile("data/library/works/...")
```

那么页面就知道：

- 数据在硬盘；
- 使用 JSON；
- 目录叫 `works`；
- 一个实体一个文件。

V2 换 SQLite 后，几乎所有页面都需要修改。

Repository 的目标是把这些细节挡在业务层之外。

## 2. 接口和实现

接口：

```text
src/domain/repositories/library-repository.ts
```

它只定义能力：

```ts
findWorkById(...)
listWorks(...)
findPersonById(...)
listPeople(...)
```

JSON 实现：

```text
src/infrastructure/repositories/json-library-repository.ts
```

V2 SQLite 实现未来会放在类似：

```text
src/infrastructure/repositories/sqlite-library-repository.ts
```

## 3. JsonFileStore 为什么单独拆出来

`JsonFileStore` 不理解“作品”是什么。

它只做：

- 列举 JSON 文件；
- `readFile`；
- `JSON.parse`；
- `JSON.stringify`；
- 原子式保存。

这样 `JsonLibraryRepository` 可以专心处理业务筛选。

这是“单一职责原则”的一个实际例子。

## 4. 什么叫原子写入

直接写正式文件时，如果程序写到一半异常退出，JSON 可能只剩半截。

V1 的基础策略是：

```text
work.json
   ↑ rename
work.json.tmp
   ↑
先完整写临时文件
```

同一文件系统里的 rename 通常是原子操作，可以显著降低损坏风险。

这还不是完整备份系统，但比直接覆盖更安全。

## 5. V1 查询为什么是在内存中过滤

当前流程：

```text
JSON 文件
   ↓
读取为 Work[]
   ↓
Array.filter()
   ↓
Array.sort()
   ↓
Facet Count
```

这个实现非常容易理解，也适合先验证产品行为。

当作品达到更大规模后，V2 会把它替换成：

```text
SQLite
 ↓
WHERE
JOIN
ORDER BY
GROUP BY
INDEX
```

调用者仍然是：

```ts
repository.listWorks(query)
```

这就是 Repository 抽象真正发挥价值的地方。
