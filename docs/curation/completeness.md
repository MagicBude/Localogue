# 资料完整度

## 1. 定位

资料完整度用于回答：

> “这条 Canonical 资料还有哪些字段值得补？”

它**不用于判断数据真假**，也不用于评价作品或人物本身。字段齐全但内容错误的记录仍可能拿到高分，所以完整度必须与 Evidence、Provenance、Review 分开理解。

## 2. Work 评分（V1-08）

V1-08 将作品元数据权重固定为 100：

| Rule ID | 字段 | 权重 |
|---|---|---:|
| `code` | 番号 | 10 |
| `original_title` | 原始语言标题（日本作品通常是日文） | 12 |
| `release_date` | 发行日期 | 10 |
| `duration` | 时长 | 8 |
| `performers` | 演员关系 | 12 |
| `maker` | Maker | 8 |
| `label` | Label | 5 |
| `series` | Series | 5 |
| `work_type` | Work Type | 7 |
| `genres` | Genre | 7 |
| `description` | 原始语言简介 | 6 |
| `cover` | Cover / Poster | 10 |

### 为什么本地视频不计分？

因为 Work 与 MediaFile 已明确分离。Localogue 可以收录“我知道这部作品，但我目前没有本地影片”的 Canonical Work；这不是元数据缺失。

## 3. Person 评分（V1-08）

| Rule ID | 字段 | 权重 |
|---|---|---:|
| `primary_name` | 日文正式名 | 12 |
| `localized_name` | 中文映射名 | 6 |
| `romanized_name` | 英文 / 罗马字名 | 5 |
| `activity_status` | 活动状态 | 7 |
| `debut` | 出道事件 | 8 |
| `birth_date` | 出生日期 | 8 |
| `birth_place` | 出生地 | 6 |
| `height` | 身高 | 5 |
| `measurements` | 三围 / Cup | 8 |
| `biography` | 简介 | 8 |
| `portrait` | 人物头像 | 10 |
| `aliases` | 别名 / 旧艺名 / 其他名称 | 5 |
| `career_events` | 职业事件 | 6 |
| `gallery` | 人物图集 | 6 |

## 4. 等级

| Score | Level |
|---:|---|
| 90–100 | `complete` |
| 75–89 | `good` |
| 50–74 | `needs_attention` |
| 0–49 | `incomplete` |

机器可读词表：`resources/vocabularies/completeness-levels.json`。

## 5. 为什么分数规则必须可解释？

如果完整度只是一个神秘的 63%，用户无法知道下一步该补什么。Localogue 因此同时返回：

```text
score
level
checks[]
missingIds[]
```

UI 可以直接把 `missingIds` 变成治理任务。
