# 数据模型总览

## 核心实体关系

```text
Person ──< WorkPerson >── Work ──< WorkGenre >── Genre
                         │
                         ├── Maker
                         ├── Label
                         ├── Series
                         ├──< WorkType
                         ├──< Tag
                         ├──< Asset
                         └──< MediaFile

Evidence ──> Work / Person / 其他实体的来源与候选字段
```

## 核心思想

- `Work` 表示作品，不代表具体视频文件；
- `Person` 表示人物，不限定演员；
- `Organization` 表示 Maker / Label 等组织实体；
- `Series` 独立建模；
- `Genre` 是受控分类；
- `Tag` 是用户自定义整理维度；
- `Asset` 管理封面、海报、剧照、人物图等；
- `MediaFile` 管理本地真实媒体；
- `Evidence` 保存来源证据。

## ID 原则

- 使用稳定内部 ID；
- 番号不是 Work 的数据库主键；
- 名称不是 Person 的主键；
- 文件路径不是 MediaFile 的永久业务 ID；
- 外部站点 ID 不能替代 Localogue 自己的 ID。
