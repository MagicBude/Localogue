# 分类模型

Localogue 把分类拆成三种：Work Type、Genre、Tag。

## Work Type

描述作品形态或发行形式，例如单体、共演、VR、写真影像、合辑。

特点：

- 使用受控词表；
- 有稳定英文 ID；
- 支持多语言显示；
- 一个作品可有多个类型。

## Genre

描述作品内容、题材、行业分类或常用分类维度。

特点：

- 使用受控词表；
- 原始来源词先作为 Raw Term，不认识时不能丢弃；
- 后续映射为 Canonical Genre。

## Tag

用户自己的整理维度，例如：

- 收藏；
- 喜欢；
- 待补资料；
- 待补高清封面；
- 待观看。

Tag 不等同于 Genre，不强制全部来自官方词表。

Tag 还可以携带 `category`、`categoryOrder` 与 `sortOrder`，用于私人资料库的展示整理。它们只影响标签管理器中的分组和顺序，不进入 WorkQuery 的匹配语义，也不把来源分类变成 Canonical Genre。Shared Tag 被整理时仍通过同 ID Private Override 保存。
