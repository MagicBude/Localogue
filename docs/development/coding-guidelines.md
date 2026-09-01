# 代码规范

## 基本原则

- TypeScript 严格模式；
- Domain Model 与 UI 类型分离；
- 受控词表 ID 不写魔法字符串；
- 日期、时长、语言等定义明确单位和语义；
- 不在组件中直接处理文件系统；
- 不让 Importer 直接修改 Canonical Library；
- 不让展示文本成为实体主键。

## 注释

注释解释“为什么”，不要复述代码。

## 文件命名

代码文件建议 kebab-case；类型和类使用 PascalCase；稳定枚举 ID 使用 snake_case 或既定词表 ID，确定后保持一致。

## 中文文档

所有项目设计文档以中文为主，必要的英文术语首次出现时写中英文对照。


## 教学型注释

Localogue 同时承担学习用途。关键模块应写中文注释解释：

- 这个模块负责什么；
- 为什么放在这一层；
- 为什么不用更直接但耦合更高的写法；
- 未来从 JSON 迁移 SQLite 时哪些边界需要保持。

不要求逐行注释。`const count = items.length` 这类代码不需要解释；Repository、Domain、Server/Client Component 边界、数据安全写入、复杂查询等设计理由需要解释。
