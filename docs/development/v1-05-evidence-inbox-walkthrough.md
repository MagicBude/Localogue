# 教材：V1-05 Evidence Inbox 与 Server Component

## 1. 为什么 Evidence Inbox 使用 Server Component

`/review` 需要读取本机：

```text
data/library/evidence/
```

浏览器不应该拥有任意本地文件系统读取权限，所以读取必须发生在 Next.js 服务端。

数据流：

```text
浏览器请求 /review
        ↓
Next.js Server Component
        ↓
Evidence Store
        ↓
本地 JSON 文件
        ↓
Entity Resolution Service
        ↓
生成 HTML
        ↓
浏览器
```

这和 V1-04 的上传不同：上传需要浏览器发 POST；审核列表只是服务器读取已有本地资料。

## 2. 为什么不为 Review 单独复制一份数据库逻辑

Review 使用现有：

```text
LibraryRepository
VocabularyRepository
```

而不是：

```text
fs.readFile("people/*.json")
```

因此 V2 换 SQLite 时，Review Service 仍然面向 Repository 接口。

## 3. Inbox 为什么先做运行时分析

Evidence 本身是历史事实，Library 会不断变化。

所以：

```text
Review 状态 = f(Evidence, 当前 Library)
```

而不是在导入当天写死：

```json
{
  "matchedPersonId": "..."
}
```

否则后来修正人物别名后，旧 Evidence 仍然保留过时匹配。

## 4. 为什么详情页显示 Raw 和 Normalized

审核时常见问题是：

> “为什么系统认为时长是 132？”

如果只展示规范化结果，很难追溯。

因此页面保留：

```text
Raw
Normalized
Canonical
```

三层视角。

这也是 Provenance（来源可追溯性）的基础。

## 5. V1-05 为什么没有“确认归档”按钮

因为一个真正安全的确认按钮必须先回答：

- 新 Person 使用什么 ID？
- Evidence title 和 Library title 哪个保留？
- `library_only` 字段是否保留？
- 多值关系是替换还是并集？
- 同名歧义人物选哪一个？
- 新 Genre 是建立受控 Genre，还是保留 Raw Term？

如果这些规则没有建模，一个“确认”按钮只是把复杂问题藏起来。

所以 V1-05 先负责看清问题，V1-06 再负责明确决策。
