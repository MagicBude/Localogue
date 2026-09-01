# Canonical Library

Canonical Library 是 Localogue 对“当前认可资料”的正式表达。

## 与 Evidence 的区别

Evidence 可以同时存在多个相互冲突的值，例如：

- NFO 标题 A；
- JSON 标题 B；
- 用户手工标题 C。

Canonical Library 只保存当前选择的正式结果，同时保留来源关系。

## V1

Canonical Library 由一组结构化 JSON 文件组成。

## V2

Canonical Library 迁移到 SQLite，但 Domain Entity ID、字段语义和受控词表 ID 尽量保持不变。

## 规范实体

- Work
- Person
- Organization
- Series
- Genre
- Tag
- Asset
- MediaFile

Evidence 不是规范实体的一部分，而是它们的来源证据。
