# 多语言架构

## 两类语言设置

### UI Language

控制菜单、按钮、提示文本。

首批支持：

- `ja`：日本語
- `zh-CN`：简体中文
- `en`：English

### Metadata Language Preference

控制作品标题、人物名称、简介、Genre 名称等内容优先显示哪种语言。

UI 语言和元数据语言不能绑死。例如用户可以使用中文 UI，但始终优先显示日文作品标题。

## 默认策略

日本作品：

1. 原文默认 `ja`；
2. 中文和英文作为本地化映射；
3. 翻译值永远不覆盖原文。

## 回退

建议默认：

- 中文优先：`zh-CN → ja → en`
- 英文优先：`en → ja → zh-CN`
- 日文优先：`ja → zh-CN → en`

## 数据原则

不要设计 `name_ja / name_zh / name_en` 到处散落的不可扩展结构。V1 Domain Model 应使用语言键对象或名称条目数组，V2 再映射成关系表。
