# CSV 导入导出

CSV 适合简单批量编辑，但不适合承载全部嵌套关系。

## 建议用途

- 作品基础字段批量修改；
- 人物基础字段批量修改；
- Genre / Work Type / Tag 映射表；
- 导出统计结果。

## 多值字段

V1 若需要在 CSV 表示多值，必须使用明确约定，例如 `|` 分隔，并在导入预览时解析。正式 Canonical Library 仍使用数组。

## 不作为真相源

CSV 修改后需经过 Import → Review → Commit，而不是直接覆盖 JSON 文件。
