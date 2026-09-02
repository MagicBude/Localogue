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


## V1 的公开 Demo 与私人资料隔离

代码仓库中的虚构演示资料放在：

```text
data/demo-library/
```

真实个人资料建议放在：

```text
data/library/
```

或仓库外独立目录，并通过 `LOCALOGUE_LIBRARY_PATH` 配置。`data/library/` 默认由 `.gitignore` 排除，避免私人资料被误提交到 Git。


## V1-09 实例设置与 Shared Pack

普通用户现在可以在 `/settings` 设置私人 Library，不再必须编辑 `.env.local`。

实例设置保存在：

```text
.localogue/settings.json
```

环境变量 `LOCALOGUE_LIBRARY_PATH` 仍保留最高优先级。

Shared Pack 使用只读多根合并：

```text
Private Library
  > Shared Pack 1
  > Shared Pack 2
```

同一稳定 ID 时，靠前的数据源胜出。Demo 仅在没有任何真实数据源时启用。


> V1-09 更新：`pnpm library:init` 现在只创建空私人资料库；教学复制 Demo 请显式使用 `pnpm library:init:demo`，避免虚构数据混入真实资料。
