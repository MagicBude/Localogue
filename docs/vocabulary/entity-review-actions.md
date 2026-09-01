# 实体审核动作词表

| ID | 日本語 | 简体中文 | English |
|---|---|---|---|
| `use_match` | 一致したエンティティを使用 | 使用已匹配实体 | Use matched entity |
| `bind_existing` | 既存候補に紐付け | 绑定已有候选 | Bind existing candidate |
| `create_new` | 新規エンティティを作成 | 创建新实体 | Create new entity |
| `skip` | 今回スキップ | 本次跳过 | Skip this value |

`ambiguous` / `unresolved` 不应拥有自动默认动作，必须由用户明确选择。
