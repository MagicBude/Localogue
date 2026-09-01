# Work：作品

## 必要字段

| 字段 | 含义 |
|---|---|
| `id` | Localogue 内部稳定 ID |
| `schemaVersion` | 数据版本 |
| `code` | 主番号 / 作品代码 |
| `titles` | 多语言标题 |
| `originalLanguage` | 原始语言，默认通常为 `ja` |
| `releaseDate` | 发行日期，可允许只有年/月精度 |
| `durationMinutes` | 官方/元数据时长，V1 核心字段 |
| `workTypeIds` | 作品类型，可多值 |
| `personRelations` | 演员、导演等人物关系 |
| `makerId` | Maker |
| `labelId` | Label |
| `seriesIds` | 系列，建议模型允许多值，UI 常用单一主系列 |
| `genreIds` | Genre |
| `tagIds` | 用户 Tag |
| `descriptions` | 多语言简介 |
| `assetIds` | 图片等资源 |
| `mediaFileIds` | 本地媒体文件 |
| `createdAt` | 加入资料库时间 |
| `updatedAt` | 最后修改时间 |

## 时长

V1 直接支持 `durationMinutes`。

未来 MediaFile 还有自己的实际文件时长，例如官方资料 120 分钟而本地文件探测为 119 分 47 秒，两者不冲突。

## 作品类型

允许多值。例如作品可能同时是：

- `vr`
- `co_starring`

## 番号

番号需要规范化，但必须保留原始 Evidence。常见展示应使用规范番号。
