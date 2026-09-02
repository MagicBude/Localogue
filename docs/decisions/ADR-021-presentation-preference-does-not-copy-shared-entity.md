# ADR-021：展示偏好不得强迫复制 Shared Entity

## 状态

Accepted · V1-10

## 决策

用户选择本地头像或封面时，使用独立 `PresentationPreference` + Local Asset，不因为显示偏好创建整个 Person/Work Local Override。

## 原因

Whole-entity override 适合“我明确修改了事实资料”，但不适合“我只喜欢另一张头像”。如果后者也复制整个实体，会无意遮蔽 Community Pack 后续对生日、别名、简介等字段的更新。
