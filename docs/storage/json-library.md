# JSON Library

## 不使用单一巨大 JSON

推荐目录：

```text
data/library/
├── works/
├── people/
├── organizations/
├── series/
├── genres/
├── tags/
├── evidence/
└── indexes/
```

## 示例

```text
works/ABC-123.json
people/person_example_001.json
```

## 优点

- 文件粒度小；
- Git Diff 清晰；
- 容易修复单条记录；
- AI 易于读取；
- 迁移 SQLite 时可逐实体导入。

## 写入

写入时应考虑：

- 临时文件；
- 原子替换；
- 格式校验；
- schemaVersion；
- 自动备份或版本控制。
