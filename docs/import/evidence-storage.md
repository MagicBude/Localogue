# Evidence 文件存储

V1-04 第一次实现真正可写的 Evidence Store。

## 默认目录

如果没有设置环境变量：

```text
data/library/evidence/
```

如果设置：

```bash
LOCALOGUE_LIBRARY_PATH=D:/LocalogueLibrary
```

则写入：

```text
D:/LocalogueLibrary/evidence/
```

## 文件结构

每个候选记录单独保存一份 JSON：

```json
{
  "schemaVersion": 1,
  "id": "evidence_...",
  "sourceType": "nfo",
  "sourceName": "ABC-123.nfo",
  "importedAt": "...",
  "raw": {},
  "normalized": {},
  "warnings": [{ "code": "missing_performers" }]
}
```

## 为什么一条候选一个文件

V1 是 File-backed Library。拆成小文件有利于：

- Git / Diff（如果用户自行管理非私人样例）；
- 单项 Review；
- 单独归档或删除 Evidence；
- V2 迁移 SQLite 时逐条导入；
- 避免一个巨大 JSON 文件每次全部重写。
