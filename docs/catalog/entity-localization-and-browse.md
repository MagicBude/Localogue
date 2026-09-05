# Entity Localization 与 Browse 展示边界

V1-27D 处理 Maker / Label / Series 的多语言显示与归属关系展示，但**不把 Browse 变成作品筛选器**。

## 1. Browse 的职责

Browse 用来回答：

> Localogue 现在认识哪些目录实体？

因此 Browse 继续只提供：

- 有作品 / 无作品 / 全部；
- 名称 / ID / Alias 搜索；
- 完整 Maker / Label / Series 目录浏览；
- 已确认父级关系的只读提示。

不会在 Browse 中增加 Maker → Label → Series 级联筛选。需要组合 Maker、Label、Series、Genre、Person 等条件时，应进入 Works 的多维筛选。

## 2. 品牌名不是普通翻译文本

Maker / Label 与描述性 Series 的名称语义不同：

- 品牌名称优先保留来源原名或已审核品牌写法；
- 没有可靠中文名时，中文界面允许继续回退到原名；
- 描述性 Label / Series 可以保存社区审核翻译；
- 社区翻译不能伪装成来源官方名称；
- 不为了填满三语字段而自动生成低置信翻译。

Community Catalog 使用 `nameKinds` 记录显示名性质：

- `source-name`：来源原名；
- `reviewed-brand-form`：已审核的品牌/拉丁字母写法；
- `community-translation`：社区审核翻译；
- `community-transliteration`：社区审核转写。

`names` 仍然是实际 UI 使用的 `ja / zh-CN / en` 显示值，`nameKinds` 只说明这些值的性质。

## 3. 关系只展示，不做 Browse 级联过滤

已确认关系仍然很重要：

```text
Maker
  └─ Label
       └─ Series
```

V1-27D 在卡片上显示已确认父级，例如：

```text
新人 NO.1 STYLE
厂商 · S1 NO.1 STYLE
0 部作品
```

或者：

```text
某厂牌
厂商 · 某 Maker
0 部作品
```

没有可靠 parent Evidence 时不显示父级，也不猜测。

## 4. 为什么不在 Browse 做级联筛选

Browse 和 Works Search 是两个不同任务：

- Browse：看目录本身；
- Works Search：根据多个维度寻找作品。

如果 Browse 再加入 Maker → Label → Series 级联条件，会和 Works 的多维 Facet 筛选产生重复入口，也会让“我只是想看看全部厂商/厂牌/系列”变复杂。

因此后续真正的 Maker + Label + Series + Genre 等组合筛选，应统一建设在作品页。
