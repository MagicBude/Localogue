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

## Repository Contract 与试运行

先构建两个数据库，再运行 Contract：

```powershell
pnpm catalog:sqlite:build
pnpm local:sqlite:build
pnpm sqlite:repository:validate
```

Contract 会复制 `local.db` 到临时文件，在副本中验证作品/人物查询、番号规范化和 Private Override，结束后删除副本。它不会修改真实私人数据库。

Web 可用 `LOCALOGUE_STORAGE=sqlite` 显式试运行；未设置时继续使用 JSON Repository。当前 Desktop 仍通过 Tauri Native JSON Adapter 读取资料，下一阶段才实现 Native SQLite Adapter，因此不能把 Web Contract 通过描述为 Desktop 已完成切换。

Desktop 已增加 `read_sqlite_library_collection` 原生命令作为迁移边界。调用方只能提供集合名；Rust 从当前设置推导 Private `local.db`、Shared Pack `catalog.db` 和应用数据目录，使用 SQLite read-only flags 打开。当前 Bridge 只用于下一阶段双读对账，尚未替换 JSON Repository；否则编辑仍写 JSON 时会造成数据库内容过期。

## 私人 local.db

私人 JSON 可以无损复制进可写 `local.db`，来源文件不会被移动或删除：

```bash
pnpm local:sqlite:build
pnpm local:sqlite:validate
```

需要恢复为可读 JSON 时：

```bash
pnpm local:sqlite:export
```

默认导出到 `var/local-sqlite-export`。`private_entities` 保存私人 Work / Person / Organization / Series / Genre / Tag / Asset；媒体、展示偏好、Evidence 和审计记录拥有独立表。图片二进制与视频仍保留在文件系统，数据库只保存受控路径和元数据。
