# Provider Genre Catalogs

这里保存的是 **Provider Coverage 的输入快照**，不是 Localogue Canonical Genre 本身。

## 状态语义

- `label-snapshot`：已经确认来源标签，但没有为了凑数据伪造 Provider ID；
- `label-snapshot-with-verified-ids`：标签快照中，只对已经有独立 Provider 证据的条目补 ID；旧跨站表里的未归属 ID 不再继承；
- `verified-id-slice`：只保存已经确认过的 `sourceId + label` 子集，不宣称完整枚举 Provider 全部分类；
- `idStatus=unresolved`：名称真实存在，但来源 ID 尚未在当前仓库证据中核实；
- `idStatus=verified-public-page / verified-public-api / verified-public-doc`：ID/name 对有 Provider 页面、API 或公开文档直接证据；
- `idStatus=provider-scoped-legacy-filter`：可以确认属于该 Provider 的旧筛选 ID 命名空间，但尚未等同于当前实时 API 导出；
- `idStatus=unresolved`：名称真实存在，但来源 ID 尚未在当前仓库证据中核实。

## 当前快照

| Provider | Snapshot | Catalog Status | Rows | 说明 |
| --- | --- | --- | ---: | --- |
| FANZA | 2026-03-20 | label-snapshot | 260 | MetaTube 社区公开 FANZA genre 替换清单；官方 DMM/FANZA API 另有 GenreSearch，可后续用 floor_id 导出 ID。 |
| JAVLibrary | 2025-03-29 | label-snapshot-with-verified-ids | 286 | MetaTube 文件作者明确注明 source: JAVLibrary；只保留独立核实的 Provider ID（当前 `a4hq=韓国`）。 |
| JAVBus | 2026-09-05 | verified-id-slice | 9 | Round 2 清除跨 Provider ID 污染后，只保留公开页面/API/文档可直接复核的 9 个 `sourceId + label`。 |
| JAVDB | 2026-09-05 | verified-legacy-web-id-slice | 32 | 现有 32 条属于 JAVDB 旧 Web Filter ID 命名空间；与现代 `/api/v2/tags?type=0..4` 的实时 numeric tag ID 分开，不混写。 |

## 覆盖率

执行：

```bash
pnpm vocabulary:provider-coverage
```

Coverage 的 `100% recognized` 只表示**当前已经收集进本目录的快照**没有静默未识别词；不表示 Provider 本身已经 100% 全量枚举。

对于复合词，例如 `寝取り・寝取られ・NTR`、`和服・浴衣`、`ベスト・総集編`，Localogue 会保留 Raw Term 并进入 Review，不会为了提高自动覆盖率强行选一个 Canonical。


## Provider ID 身份规则

`genre-source-aliases.*` 的 `sources` 不能作为 ID 归属依据。Provider Catalog 只有在以下条件之一成立时才能写 `sourceId`：

1. Approved Alias 明确给出相同 `idSource + sourceId`；
2. 当前 Provider 页面/API/公开文档直接给出该 ID/name 对。

Validator 会检查已归属 ID 是否被其它 Provider Catalog 误用。名称 Evidence 可以跨站复用，Provider ID 不可以。
