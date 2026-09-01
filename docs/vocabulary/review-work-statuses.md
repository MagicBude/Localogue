# Review 作品状态

| ID | 日本語 | 简体中文 | English | 说明 |
|---|---|---|---|---|
| `existing_clean` | 既存作品・一致 | 已有作品 · 基本一致 | Existing · clean match | 番号命中已有作品，当前比较字段均一致 |
| `existing_conflict` | 既存作品・差分あり | 已有作品 · 存在差异 | Existing · conflicts | 番号命中已有作品，但存在字段差异 |
| `new_work` | 新規作品候補 | 新作品候选 | New work candidate | 当前资料库没有同番号作品 |
| `missing_code` | 品番不足 | 缺少番号 | Missing code | 缺少最可靠的作品唯一匹配条件 |

机器可读版本：`resources/vocabularies/review-work-statuses.json`。
