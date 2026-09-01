# Person：人物

Person 是 Localogue 的核心实体之一。V1 UI 会重点优化“女优/演员”资料页，但底层 Person 同样可承载导演。

## 基本资料

| 字段 | 含义 |
|---|---|
| `id` | 内部稳定 ID |
| `names` | 正式名、本地化名、罗马字、别名、旧名等 |
| `activityStatus` | 当前活动状态 |
| `careerEvents` | 出道、引退、复出、改名等时间线 |
| `birthDate` | 出生日期 |
| `birthPlace` | 多语言出生地 |
| `heightCm` | 身高 |
| `measurements` | B / W / H / Cup |
| `biographies` | 日 / 中 / 英简介 |
| `organizationRelations` | 事务所 / 所属组织及历史关系 |
| `portraitAssetId` | 主头像 |
| `galleryAssetIds` | 其他人物图片 |

## 姓名

姓名必须区分：

- 正式名；
- 本地化名；
- 罗马字；
- 艺名；
- 别名；
- 旧艺名 / 曾用名；
- 其他写法。

不要把这些全部塞进 `aliases: string[]`。

## 职业状态

`activityStatus` 表示当前状态，`careerEvents` 表示历史。

示例：

```text
2015-10 出道
2022-06 引退
2023-02 复出
当前    在役
```

## 作品关系

人物页作品列表使用统一 WorkQuery，并预置当前人物条件。支持在人物页内继续按：年份、Maker、Series、Work Type、Genre、时长等筛选。
