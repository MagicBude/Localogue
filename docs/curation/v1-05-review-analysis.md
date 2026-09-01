# V1-05：Evidence 审核分析模型

## 1. 这一阶段解决什么问题

V1-04 已经能把 JSON、NFO、CSV、XLSX 转成 Evidence，但“保存了一份证据”并不代表资料已经可信。

V1-05 加入中间层：

```text
Evidence
  ↓
Review Analysis
  ├─ Work 是否已经存在？
  ├─ 人物能否匹配？
  ├─ 厂商 / 厂牌 / 系列能否匹配？
  ├─ Genre / Work Type / Tag 能否匹配？
  └─ Evidence 与 Canonical Work 哪些字段不同？
```

这一阶段的核心目标是**让判断依据透明化**，而不是自动替用户做决定。

## 2. 为什么 ReviewAnalysis 不写回 Evidence

Evidence 是“来源曾经告诉过我们什么”的历史记录，应尽量保持稳定。

Review Analysis 则取决于“当前资料库状态”。例如今天某位演员还没有建档，分析结果是 `new`；明天用户建立了该人物后，同一条 Evidence 再分析可能变成 `matched`。

因此 V1-05 的分析结果采用**运行时计算**：

```text
Evidence（稳定）
+
Canonical Library（会变化）
↓
ReviewAnalysis（可重新计算）
```

后续如果确实需要保存审核决策，会另建 Review Decision，而不是篡改 Evidence。

## 3. Work 状态

| ID | 中文含义 | 说明 |
|---|---|---|
| `existing_clean` | 已有作品，基本一致 | 番号命中正式作品，当前比较字段没有差异 |
| `existing_conflict` | 已有作品，存在差异 | 番号命中，但字段值或关系不同 |
| `new_work` | 新作品候选 | 有番号，但 Canonical Library 中尚不存在 |
| `missing_code` | 缺少番号 | 无法执行最可靠的作品唯一匹配 |

V1-05 **不根据标题模糊猜测 Work**。作品唯一性首先依赖规范化后的番号。

## 4. 实体匹配状态

| ID | 中文含义 | 说明 |
|---|---|---|
| `matched` | 已匹配 | 规范化精确命中唯一实体 |
| `new` | 新实体候选 | 有明确来源值，但当前资料库没有命中 |
| `ambiguous` | 存在歧义 | 同一来源值精确命中了多个实体 |
| `unresolved` | 未解决 | 为未来无法解释的输入保留 |

注意：`new` 不是“已经创建”。它只表示 Review 时应考虑是否新建实体。

## 5. 字段比较状态

| ID | 中文含义 | 说明 |
|---|---|---|
| `same` | 一致 | Evidence 与 Library 在当前规则下相同 |
| `different` | 不同 | 两边都有值，但不一致 |
| `evidence_only` | 仅 Evidence 有值 | 可作为补全候选 |
| `library_only` | 仅 Library 有值 | 不能因为 Evidence 缺失就自动删除 |

这里最重要的原则是：

> “Evidence 没写某个字段”不等于“用户要求删除资料库里的字段”。

因此 `library_only` 必须和明确的空值覆盖语义区分。

## 6. 当前比较字段

V1-05 对已有作品比较：

- 番号；
- 标题；
- 发行日期；
- 时长；
- 简介；
- 演员；
- 导演；
- Maker；
- Label；
- Series；
- Genre；
- Tag；
- Work Type。

V1-06 将在这个比较结果之上增加“字段级采用决策”。

## 7. 为什么现在不自动合并

例如已有作品：

```text
演员：A
Genre：剧情
```

Evidence：

```text
演员：A、B
Genre：剧情、制服
```

程序不能仅凭“新数据更多”就断言 B 和“制服”一定正确。

所以 V1-05 只回答：

```text
这里有差异。
A 已匹配。
B 是新实体候选。
“剧情”已匹配。
“制服”已匹配到 Genre vocabulary。
```

“最后采用什么”必须留给明确 Review Decision。
