# V1-08 教材导读：人物资料写入链路

## 1. 读取和写入是两回事

浏览人物时：

```text
Page → LibraryRepository → JSON
```

编辑人物时则是：

```text
Client Form
  ↓ JSON DTO
PUT /api/people/[id]
  ↓
PersonEditService
  ↓ 校验
LibraryRepository.savePerson()
  ↓
PersonEditReceipt
```

API 不直接把浏览器传来的 JSON 写进文件。

## 2. 为什么要服务端重新校验？

浏览器表单可以被绕过，HTTP 请求也可以手工构造。所以：

> 前端校验改善体验，后端校验保护数据。

V1-08 后端会检查：

- activityStatus 是否属于受控值；
- 是否保留至少一个日文 `primary` 姓名；
- 姓名 type / language 是否允许；
- 日期是否是 YYYY / YYYY-MM / YYYY-MM-DD；
- 数值字段是否有效。

## 3. 为什么保留日期精度？

如果只知道某人的出道月份 `2020-06`，不应该伪造 `2020-06-01`。

所以编辑器把：

- `2020` → year；
- `2020-06` → month；
- `2020-06-18` → day。

## 4. JSON 为什么还需要 before / after Receipt？

因为直接覆盖 Person 会丢掉修改前内容。V1-08 把每次人工修改记录到 `person-edits/`：

```text
before
changedFields
after
editedAt
```

Receipt 写入失败时，服务会尝试将 Person 恢复为 before-image。

这仍然不是数据库 ACID Transaction，但已经能学习“审计记录”和“补偿式事务”思想。
