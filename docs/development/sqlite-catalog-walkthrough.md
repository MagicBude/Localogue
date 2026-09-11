# 教材：Curated Catalog 怎样构建为 SQLite

## 为什么同时保留 JSON 与 SQLite

Community Git 仓库中的 JSON 便于逐实体审核、比较和接受 Pull Request；Desktop 运行时更需要索引、关联查询和事务。两者不是两份独立真相：JSON 是可维护的发布源，`catalog.db` 是由它和主程序受控词表确定性构建的查询投影。

## 构建

默认读取同级目录 `localogue-community-data`，输出到 Git 忽略的 `.localogue/catalog.db`：

```bash
pnpm catalog:sqlite:build
pnpm catalog:sqlite:validate
```

也可以指定来源和输出：

```bash
node scripts/build-catalog-sqlite.mjs --source D:\path\to\shared-pack --output D:\path\to\catalog.db
node scripts/validate-catalog-sqlite.mjs D:\path\to\catalog.db D:\path\to\shared-pack\library
```

构建器先写 `.tmp`，所有实体和关系成功提交后才替换正式文件。校验器检查集合计数、SQLite 完整性、外键、Schema 版本，以及 Community Classification 是否全部经过 Crosswalk。

## 分类为什么在构建时拆开

早期 Community 数据把 325 种 Classification 都存放在 `genreIds`。SQLite 投影不会延续这个混合结构，而是通过 `community-classification-crosswalk` 分别写入：

- `work_genres`；
- `work_types`；
- `work_source_classifications`。

无法解释的旧 ID 会进入 `work_unmapped_classifications`，正式校验要求该表为空。这样数据库中只有一套 Localogue 稳定分类 ID，同时保留 `classification_crosswalk` 供追溯旧社区 ID。

## 人工打开

`.db` 是标准 SQLite 3 文件，可用 SQLiteStudio、DB Browser for SQLite 或 DBeaver 打开。建议以只读方式查看；`json` 列保存完整原实体，普通列和关系表用于筛选、排序与关联。

当前阶段只完成 `catalog.db` 构建与对账，默认 Repository 尚未切换。下一阶段会增加 SQLite Repository Contract Test，通过后再让 Desktop 优先读取数据库。

