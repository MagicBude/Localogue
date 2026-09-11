# ADR-046：公共 Catalog 与私人资料分别使用 SQLite

**状态：已接受。**

## 背景

Localogue 的 JSON Repository 已验证领域模型，但作品、人物、分类、Provider Evidence、媒体文件和审核历史增长后，逐目录扫描不再适合高频组合筛选、关联检查和人工查阅。同时，“Canonical Library”与“Community Shared Pack”在产品语言上像两套公共数据库，增加了理解成本。

## 决策

数据概念收敛为三层：

1. **Source Evidence**：外部网站、NFO 和连接器的不可变来源证据；
2. **Curated Catalog**：Localogue 审核后的公共作品、人物、组织、系列、分类和三语名称；Shared Pack 是其只读发布包；
3. **Personal Library**：本地媒体、私人覆盖、收藏、评分、展示偏好和审计历史。

运行时逐步迁移为两个 SQLite 文件：

- `catalog.db`：公共 Curated Catalog，只读安装或整体替换；
- `local.db`：用户私人资料，可写且必须可独立备份。

JSON 继续作为 Git 维护、交换、Portable Pack 与回滚格式；CSV 继续作为人工审核格式。SQLite 行号不得成为业务 ID，Domain ID 和 Repository 接口保持稳定。

## 迁移策略

1. 先建立可重复的 JSON → `catalog.db` 构建器和逐集合对账；
2. 在不改变 UI / Query Model 的前提下增加 SQLite Repository；
3. 先切换公共只读查询，再迁移私人写入；
4. 每阶段保留 JSON Adapter 回退，完成数据对账后才切换默认实现；
5. 最终停止运行时遍历“一实体一 JSON”，但不取消 JSON 导入导出。

## 人工查阅

两个数据库都是标准 SQLite 3 文件，可用 SQLiteStudio、DB Browser for SQLite 或 DBeaver 打开。外部工具浏览时应使用只读模式；程序运行期间不建议从外部工具直接写入 `local.db`。

