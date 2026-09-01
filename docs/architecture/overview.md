# 总体架构

Localogue 从逻辑上分成六层：

```text
输入层
NFO / JSON / CSV / XLSX / Folder / Manual
                    ↓
Evidence 层
保存原始输入、来源、时间、校验摘要
                    ↓
规范化层
字段格式、番号、日期、语言、名称、词表映射
                    ↓
实体解析与审核层
作品匹配 / 人物匹配 / 冲突检测 / Review
                    ↓
Canonical Library
Work / Person / Organization / Series / Classification
                    ↓
探索与输出层
Web / Search / Facet / Timeline / Export
```

## V1 技术边界

V1 的 Canonical Library 物理上是 JSON 文件，但业务层只依赖 Domain Model 和 Repository 接口。

```text
UI
 ↓
Application Service
 ↓
Repository Interface
 ↓
JsonLibraryRepository   ← V1
SqliteLibraryRepository ← V2
```

## 为什么这样做

这样既能让 V1 快速看到效果，也避免 V2 更换 SQLite 时重写页面和业务规则。
