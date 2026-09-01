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
