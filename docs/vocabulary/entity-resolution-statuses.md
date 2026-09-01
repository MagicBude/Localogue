# 实体匹配状态

| ID | 日本語 | 简体中文 | English | 说明 |
|---|---|---|---|---|
| `matched` | 一致 | 已匹配 | Matched | 唯一精确命中已有实体 |
| `new` | 新規候補 | 新实体候选 | New candidate | 没有精确命中，等待确认是否新建 |
| `ambiguous` | 曖昧 | 存在歧义 | Ambiguous | 同时命中多个实体，必须人工选择 |
| `unresolved` | 未解決 | 未解决 | Unresolved | 输入不足或当前规则无法解释 |

机器可读版本：`resources/vocabularies/entity-resolution-statuses.json`。
