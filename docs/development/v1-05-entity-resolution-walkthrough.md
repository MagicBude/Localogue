# 教材：V1-05 实体匹配是怎样工作的

## 1. 从字符串到实体

导入器看到的是字符串：

```json
{
  "performers": ["星野みづき"]
}
```

Canonical Work 不能把这个字符串直接存进去，它需要：

```text
person_hoshino_mizuki
```

因此中间必须有 Entity Resolution：

```text
"星野みづき"
      ↓
规范化
      ↓
查找 Person.names
      ↓
唯一命中 person_hoshino_mizuki
```

对应实现：

```text
src/application/review/entity-resolution-service.ts
```

## 2. 为什么会搜索所有姓名类型

`Person.names` 不只有正式名：

```text
primary
localized
romanized
alias
former_name
stage_name
alternate
```

如果旧 NFO 使用旧艺名，而资料库只允许按当前正式名匹配，就会制造重复人物。

因此人物匹配会检查 `Person.names` 中的全部名称。

## 3. 什么叫“规范化后的精确匹配”

V1-05 的 `normalizeIdentityText()` 只处理：

- Unicode NFKC 规范化；
- 去除首尾空白；
- 大小写统一；
- 去除字符串内部无意义空白。

它**不会**做：

- 编辑距离模糊匹配；
- 拼音相似；
- 自动猜测错别字；
- 日文汉字与中文简繁自动等同；
- AI 猜人。

原因是资料治理最怕“错误合并”。

## 4. 为什么模糊匹配要晚一点做

假设资料库有：

```text
山田美月
山田みづき
```

输入：

```text
山田みつき
```

模糊算法可能觉得两个都很像。

如果程序直接选第一个，错误会进入 Canonical Library，而且以后很难发现。

更安全的流程是：

```text
输入名称
↓
精确规则没有命中
↓
new / ambiguous
↓
人工 Review
```

未来可以加入“相似候选建议”，但**建议不等于自动匹配**。

## 5. Maker / Label 为什么先按 kind 分组

Organization 是统一实体：

```text
maker
label
agency
other
```

同样一个名称理论上可能出现在不同 kind 中。

因此匹配 Maker 时只在：

```text
organization.kind === "maker"
```

中查找；Label 同理。

这就是“先利用结构化语义缩小候选集”。

## 6. JSON 时代和 SQLite 时代的区别

V1 为了教学和快速迭代，会一次加载人物、组织、系列等集合，在内存里建立比较上下文。

V2 SQLite 后不会照搬成“把整库读取到内存”。对应关系会变成：

```sql
SELECT ... FROM person_names
WHERE normalized_name = ?;
```

但是上层仍然得到：

```text
matched / new / ambiguous
```

这就是 Domain 语义与持久化实现分离的价值。
