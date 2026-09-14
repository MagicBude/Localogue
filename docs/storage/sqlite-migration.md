# V2 SQLite 迁移

SQLite 是 Localogue 的持久化升级，不改变 Domain ID、Repository 接口或审核原则。V2 将过去容易混淆的 Canonical Library / Community Shared Pack / Private Library 收敛为三个业务层，并使用两个运行时数据库。

## 一、三个业务层

1. **Source Evidence**：Provider、NFO、Connector 等外部输入的不可变证据，以及独立的审核生命周期；
2. **Curated Catalog**：经 Localogue 规范化、匹配和审核后的公共实体与三语名称；
3. **Personal Library**：私人 Canonical Override、本地媒体、收藏、评分、展示偏好和审计历史。

Shared Pack 只是 Curated Catalog 的只读发布包，不是第四套数据库。详细决策见 `docs/decisions/ADR-046-sqlite-catalog-and-personal-databases.md`。

## 二、两个数据库

- `catalog.db`：Curated Catalog 的只读发布投影。Desktop 只读打开，安装新版本时整体替换；
- `local.db`：当前 Library Profile 的可写私人数据库，位于 Private Library 根目录。

数据库使用稳定 Domain ID，不把 SQLite 行号暴露为业务 ID。Asset 二进制和视频文件仍在文件系统中，数据库只保存结构化元数据与路径引用。

## 三、JSON、CSV 与 SQLite 的职责

- JSON 是 Git 维护、Portable Pack、人工检查和灾难恢复格式；
- CSV 是受控词表、Provider Evidence 和批量人工审核格式；
- SQLite 是 Desktop 的高频查询与私人写入格式；
- NFO 是外部导入格式，进入 Localogue 后仍遵守 Evidence / Bootstrap 约束。

保留 JSON/CSV 不等于数据库化的数据根每次查询仍要扫描 JSON。Native SQLite Reader 会返回当前集合实际覆盖的数据根；Repository 只为缺少 `catalog.db` 的旧 Shared Pack 使用 JSON Adapter。

## 四、可重复命令

公共 Catalog：

```powershell
pnpm catalog:sqlite:build
pnpm catalog:sqlite:validate
pnpm catalog:sqlite:publish
```

私人资料库：

```powershell
pnpm local:sqlite:build -- --source <Private Library 路径> --output <local.db 路径>
pnpm local:sqlite:validate -- <local.db 路径> <Private Library 路径>
pnpm local:sqlite:export -- --database <local.db 路径> --output <导出目录>
```

Repository Contract：

```powershell
pnpm sqlite:repository:validate
```

这些命令都使用临时文件或独立输出目录。构建成功后才原子发布数据库；验证与回导不会修改来源 JSON。

## 五、Desktop 运行时切换

Desktop 启动或切换 Library Profile 时执行以下步骤：

1. Private Library 没有 `local.db` 时，从现有 JSON 构建临时数据库；
2. 比较所有集合的稳定 ID 与完整 JSON 内容；
3. 只有 `missingInSqlite`、`missingInJson`、`contentMismatches` 全部为空才启用 SQLite 读取；
4. 写入通过受限 Native Command 同步保存 JSON 与 `local.db`；SQLite 镜像失败时恢复 JSON before-image 并返回失败；
5. Presentation Preference、Evidence 和治理审计遵守同一个门控；
6. 带 `catalog.db` 的 Shared Pack 直接读取数据库，旧 Pack 继续只读 JSON；
7. 多数据源优先级始终是 `Private Library > Shared Pack 1 > Shared Pack 2 > …`。

Web 入口保留显式 `LOCALOGUE_STORAGE=sqlite` Repository Contract，供过渡验证和部署使用。它是否随 Next.js 产品壳一起退役属于独立产品决策，不影响 Desktop 的数据库迁移结果。

## 六、失败与恢复边界

- 自动迁移失败或对账存在差异时，Desktop 继续读取 JSON，不把未验证数据库当真相；
- `local.db` 可以通过导出器重新生成一实体一 JSON；
- Shared Portable Pack 同时携带 `catalog.db`、可审核 JSON 与 Sources，并在安装前校验 SHA-256、SQLite integrity、Schema、Pack ID 与版本；
- 外部 SQLite 工具应以只读模式浏览数据库，程序运行期间不要直接修改 `local.db`；
- JSON Snapshot 仍是补偿式恢复机制，不能描述成数据库 ACID Transaction。

## 七、完成判据

- Community JSON 与 `catalog.db` 的实体、关系、词表、完整性和 Pack 身份全部对账；
- 当前 Profile 的 JSON 与 `local.db` 逐集合零差异；
- SQLite → JSON 回导数量与数据库中的实体、媒体、偏好、Evidence 和审计总数一致；
- Desktop 数据库化数据根不再发生重复 JSON 遍历；
- 全部数据、审计、平台和 Desktop Boundary 校验通过；
- 主仓库与 Community Data 仓库分别提交并推送。
