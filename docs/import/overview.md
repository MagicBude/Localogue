# 导入总览

V1 的输入渠道：

- Localogue JSON；
- CSV；
- XLSX；
- NFO；
- 文件夹扫描；
- 手工录入。

所有输入统一走：

```text
Importer → Evidence → Normalize → Resolve → Validate → Review → Commit
```

## 原则

导入不是“把文件内容直接写到正式资料”。

任何导入都应该先能回答：

- 新增了什么？
- 修改了什么？
- 哪些字段冲突？
- 匹配到了哪些已有实体？
- 哪些是新人物 / 新系列 / 新 Genre？
- 是否疑似重复作品？


## V1-04 实现状态

V1-04 已实现 JSON、NFO、CSV、XLSX 的 Parser → Normalize → Validate → Preview → Evidence Store。 Web 的一般导入仍遵循这条治理链；V1-16 Desktop 另外提供面向本地存量 NFO 的显式 Bootstrap Ingest，范围与限制见 `docs/import/nfo.md`。

尚未实现 Resolve / Review / Commit，因此 Evidence 中的人物、厂商、系列和 Genre 仍可保留来源字符串，不会直接变成 Canonical Entity ID。
