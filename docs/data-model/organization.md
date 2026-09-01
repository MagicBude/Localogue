# Organization：组织

Localogue 需要区分 Maker 与 Label。

## Maker

通常表示制作/发行体系中的厂商或公司级实体。

## Label

通常表示 Maker 下的品牌、厂牌或作品线。

## 为什么分开

两者在真实资料中经常不是同一个概念。把它们合并会导致浏览和统计失真。

## 建议字段

- `id`
- `kind`: `maker` / `label`
- `names`
- `parentOrganizationId`
- `descriptions`
- `logoAssetId`
- `externalRefs`

未来可以支持从 Label 反查 Maker，从 Maker 浏览旗下 Label 和全部作品。
