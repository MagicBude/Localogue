# Evidence 模型

Evidence 表示“一次外部输入提供了什么信息”。

## 来源类型

- `manual`：人工录入；
- `localogue_json`：Localogue JSON；
- `nfo`：NFO；
- `csv`：CSV；
- `xlsx`：XLSX；
- `folder_scan`：目录扫描；
- `connector`：未来外部 Connector。

## 建议字段

```json
{
  "id": "evidence_xxx",
  "sourceType": "nfo",
  "sourceName": "本地 NFO",
  "importedAt": "2026-09-01T17:00:00+08:00",
  "sourcePath": "D:/Media/ABC-123/ABC-123.nfo",
  "checksum": "...",
  "raw": {},
  "normalized": {}
}
```

## 原则

- Evidence 可以删除或归档，但不能偷偷改写其原始内容；
- Review 过程中产生的人工选择应单独记录；
- Connector 未来只能产生 Evidence；
- 对重要字段应能解释“为什么当前值是这个”。
