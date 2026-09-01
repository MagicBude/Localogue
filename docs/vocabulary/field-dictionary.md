# 核心字段对照表

本表用于快速理解 Localogue 常见字段的中 / 日 / 英显示名称。程序字段名保持英文稳定 ID。

## Work

| 字段 | 日本語 | 简体中文 | English | 说明 |
|---|---|---|---|---|
| `code` | 品番 | 番号 | Code | 作品主番号 |
| `title` | タイトル | 标题 | Title | 当前语言标题 |
| `original_title` | 原題 | 原始标题 | Original Title | 原始语言标题 |
| `release_date` | 発売日 | 发行日期 | Release Date | 支持日期精度 |
| `duration` | 収録時間 | 时长 | Duration | V1 使用分钟 |
| `performer` | 出演者 | 演员 | Performer | Person 关系 |
| `director` | 監督 | 导演 | Director | Person 关系 |
| `maker` | メーカー | 厂商 | Maker | Organization |
| `label` | レーベル | 厂牌 | Label | Organization |
| `series` | シリーズ | 系列 | Series | 系列实体 |
| `work_type` | 作品タイプ | 作品类型 | Work Type | 可多值 |
| `genre` | ジャンル | 分类 | Genre | 受控分类 |
| `tag` | タグ | 标签 | Tag | 用户整理标签 |
| `description` | あらすじ | 简介 | Description | 多语言文本 |
| `cover` | カバー | 封面 | Cover | Asset |
| `media_file` | メディアファイル | 媒体文件 | Media File | 本地文件 |
| `added_at` | 追加日時 | 加入时间 | Added At | 加入资料库时间 |
| `updated_at` | 更新日時 | 更新时间 | Updated At | 最近修改时间 |

## Person

| 字段 | 日本語 | 简体中文 | English | 说明 |
|---|---|---|---|---|
| `primary_name` | 正式名 | 正式名 | Primary Name | 当前主要名称 |
| `localized_name` | 翻訳名 | 本地化名称 | Localized Name | 中文等映射 |
| `romanized_name` | ローマ字 | 罗马字名 | Romanized Name | 拉丁字母转写 |
| `alias` | 別名 | 别名 | Alias | 常见别名 |
| `former_name` | 旧名 | 旧艺名 / 曾用名 | Former Name | 历史名称 |
| `activity_status` | 活動状況 | 活动状态 | Activity Status | 在役 / 引退等 |
| `debut_date` | デビュー時期 | 出道时间 | Debut Date | 可只有年月 |
| `retirement_date` | 引退時期 | 引退时间 | Retirement Date | 可为空 |
| `birth_date` | 生年月日 | 出生日期 | Birth Date | 可带精度 |
| `birth_place` | 出身地 | 出生地 | Birth Place | 多语言 |
| `height` | 身長 | 身高 | Height | cm |
| `bust` | バスト | 胸围 | Bust | cm |
| `waist` | ウエスト | 腰围 | Waist | cm |
| `hip` | ヒップ | 臀围 | Hip | cm |
| `cup` | カップ | Cup | Cup | 可为空 |
| `biography` | プロフィール | 个人简介 | Biography | 多语言 |
| `portrait` | プロフィール画像 | 个人头像 | Portrait | Asset |
