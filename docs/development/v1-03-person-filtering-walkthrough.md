# V1-03：人物库高级筛选讲解

人物资料是 Localogue 的核心内容之一，因此人物库不能只有姓名搜索。

V1-03 首批加入：

- 姓名、中文映射、罗马字、别名、旧艺名、曾用名搜索；
- 当前状态；
- 出生年份；
- 出道年份；
- 引退年份；
- 身高范围；
- 姓名、出生时间、出道时间、身高排序。

## 为什么别名也能搜到

`Person.names` 本来就是数组：

```text
primary
localized
romanized
alias
former_name
stage_name
alternate
```

搜索时不是只取 `primary`，而是把所有姓名值组合成可搜索文本。

因此用户即使只记得旧艺名，也可以找到同一个 Person Entity。

## 为什么出道/引退不是 Person 的单一字段

Localogue V0 已经决定使用 `careerEvents`：

```json
{
  "type": "debut",
  "date": { "value": "2018-04", "precision": "month" }
}
```

这样未来可以表示：

```text
出道 → 引退 → 复出 → 再次休止
```

而不是只能保存一个 `debutDate` 和一个 `retirementDate`。

人物筛选器会从职业事件中提取相应年份。

## JSON V1 与 SQLite V2 的关系

V1 当前是：

```text
PersonQuery
→ 读取 people JSON
→ Array.filter()
→ Array.sort()
```

V2 可以自然转成：

```text
PersonQuery
→ SQL WHERE
→ JOIN career_events
→ ORDER BY
```

这也是我们坚持让 UI 依赖 Domain Query，而不是直接操作 JSON 的原因。
