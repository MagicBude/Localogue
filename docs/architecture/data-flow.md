# 数据流

## 导入流

```text
输入
 ↓
Importer
 ↓
Evidence
 ↓
Normalize
 ↓
Resolve
 ↓
Validate
 ↓
Review
 ↓
Canonical Library
```

### Importer

只负责把某种外部格式转换成统一导入模型，不负责直接修改正式资料。

### Evidence

保存“来源到底说了什么”。

### Normalize

处理：番号格式、日期、空白、语言代码、单位、受控词表 ID 等。

### Resolve

尝试把输入中的“桃乃木かな”关联到已有 Person，而不是每次创建新人物。

### Review

显示新增、变化、冲突和匹配结果，让用户确认。

### Commit

确认后才写入 Canonical Library。

## 浏览流

```text
URL Query
 ↓
WorkQuery / PersonQuery
 ↓
Query Service
 ↓
Repository
 ↓
Facet + Sort + Result
 ↓
Web UI
```
