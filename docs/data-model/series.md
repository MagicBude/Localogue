# Series：系列

Series 是独立实体，用于把同一作品企划或系列下的多个 Work 关联起来。

## 字段

- `id`
- `names`
- `descriptions`
- `parentOrganizationId`（可选，优先指向已确认的 Label；只有 Maker 证据时可指向 Maker）

V1 当前不在 Series 上同时保存 `makerId` 与 `labelId`。两份可互相矛盾的父级字段会让关系治理和未来 SQLite 外键映射变复杂，因此只保存一条有 Evidence 支持的最具体父级关系；没有可靠证据时保持为空。

## 页面能力

系列详情页至少展示：

- 系列名及多语言名称；
- 所属 Maker / Label；
- 作品数量；
- 时间跨度；
- 系列内作品筛选与排序。
