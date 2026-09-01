# NFO

NFO 是 Localogue 的一等输入/输出格式，但不是最终真相源。

## 输入

支持读取常见媒体管理软件生成的 NFO，提取：

- 番号 / 标题；
- 原始标题；
- 演员；
- 导演；
- Maker / Studio；
- Series；
- Genre / Tag；
- 日期；
- 时长；
- 简介；
- 图片引用；
- 外部 ID。

不同软件字段差异应由 NFO Importer 负责兼容。

## 输出

Canonical Library 可重新生成 NFO，供 Kodi / Jellyfin / Emby 等使用。

## 原则

一旦资料进入 Localogue，后续人工修改以 Canonical Library 为准；NFO 可重新导出，而不是把 NFO 继续当数据库。
