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

Web 可用 `LOCALOGUE_STORAGE=sqlite` 显式试运行；未设置时继续使用 JSON Repository。Desktop 通过受限 Native SQLite Adapter 读取当前 Profile 的 `local.db` 和已挂载 Shared Pack 的 `catalog.db`；WebView 只能指定集合，不能指定数据库路径。

Desktop 已增加 `read_sqlite_library_collection` 原生命令作为迁移边界。调用方只能提供集合名；Rust 从当前设置推导 Private `local.db`、Shared Pack `catalog.db` 和应用数据目录，使用 SQLite read-only flags 打开。

当 Private 根目录存在 `local.db` 时，Native Writer 会先保存 JSON，再同步镜像数据库；数据库失败会恢复 JSON 写前内容并向 UI 返回失败。设置 → 工具 → JSON / SQLite 对账会逐集合比较稳定 ID 和解析后的 JSON 内容。

Desktop 启动或切换 Library Profile 时会检查 `<Private Library>/local.db`。若文件不存在，Native Runtime 在同一目录创建临时数据库，导入所有受支持的私人 JSON，记录 Migration Receipt，将 WAL 合并回主文件，再原子重命名为 `local.db`。原 JSON 不移动、不删除。

数据库只有在下列条件全部成立时才进入读取路径：

- JSON 与 SQLite 实体总数一致；
- 双方没有缺失的 `collection/id`；
- 对应实体解析后的 JSON 内容一致。

任何创建错误或对账差异都会让当前 Profile 继续使用 JSON。这样迁移是可逐库回退的，不会因为存在一个残缺数据库就静默切换。Shared Pack 如果尚未发布 `catalog.db`，仍从只读 `library/*.json` 补齐；下一节点将把 `catalog.db` 纳入 Shared Pack 发布和安装验证。

## 私人 local.db

私人 JSON 可以无损复制进可写 `local.db`，来源文件不会被移动或删除：

```bash
pnpm local:sqlite:build
pnpm local:sqlite:validate
```

Desktop 按约定读取当前 Private Library 根目录下的 `local.db`。为现有资料库启用双写前，可显式原地迁移：

```powershell
node scripts/build-local-sqlite.mjs --source D:\path\to\private-library --output D:\path\to\private-library\local.db
```

脚本只允许根目录这个固定文件名，不允许把数据库写入 `works/`、`assets/` 等集合目录。原 JSON 保留，用于交换、审核和 Snapshot / Restore。

需要恢复为可读 JSON 时：

```bash
pnpm local:sqlite:export
```

默认导出到 `var/local-sqlite-export`。`private_entities` 保存私人 Work / Person / Organization / Series / Genre / Tag / Asset；媒体、展示偏好、Evidence 和审计记录拥有独立表。图片二进制与视频仍保留在文件系统，数据库只保存受控路径和元数据。
