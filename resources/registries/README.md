# Entity Registry Resources

这里保存 Localogue Community Data 的 Maker / Label / Series 来源证据。

本目录是**静态资料库**，不是采集工具配置目录。Localogue 本身不负责抓取 Provider，也不要求 API 凭证。
数据可以来自公开页面、厂商官网、外部工具或人工整理；进入仓库前必须保留来源并通过人工审核。

## 文件

- `provider-entity-sources.{json,csv}`：来源能力和证据边界。
- `organization-source-evidence.{json,csv}`：Maker / Label 来源名称与 Provider ID 证据。
- `series-source-evidence.{json,csv}`：Series 来源名称与 Provider ID 证据。

## 状态

- `verified`：该 Provider namespace 内的 ID/name 配对已有可复核证据。
- `name-only`：仅确认名称出现，不声明稳定 ID。

## 约束

- 不跨 Provider 复用 ID。
- 不因名称相似自动合并 Canonical。
- 不把“当前切片 100% 已审核”描述成“Provider 全量覆盖”。
- Series 归属没有证据时保持空值。

## 与 Community Catalog 的关系

Registry 保存“来源说了什么”；`resources/catalogs/` 保存“Localogue 人工审核后最终认为什么”。

同一个现实 Maker / Label / Series 可以在 Registry 里拥有多条 Provider Evidence，但 Community Catalog 只保留一个 Canonical ID。审核确认后，Evidence 使用 `canonicalId` 指向 Catalog；证据不足的记录继续留在 Registry，不会为了提高覆盖率而强行合并。

当前映射情况可通过：

```bash
pnpm registry:coverage
pnpm validate:catalog
```

查看。

## 本地维护检查

```bash
pnpm validate:registry
pnpm registry:coverage
pnpm registry:audit
```

这些命令只检查/汇总仓库内静态数据，不访问网络。
