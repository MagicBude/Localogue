# Localogue 与 localogue-community-data 对接

正式 Community Data 仓库：

```text
https://github.com/MagicBude/localogue-community-data
```

## 两种接入方式

### Git 目录挂载

最适合开发与日常更新：

```text
git clone .../localogue-community-data
Localogue /settings → Shared Pack Paths → 仓库根目录
```

更新时直接 `git pull`，Localogue 下一次读取即可看到新版本。

### Portable Pack 安装

适合离线转发：先由已经挂载该仓库的 Localogue 在 `/packs` 导出 `.localogue-pack`，另一台机器上传安装。

## Validator 对齐

V1-11 主项目内置 Community Validator，与 Community Data V0-01 的核心规则保持一致：

- `person/work/maker/label/series/genre_<UUIDv4>`；
- Person 至少一个日文 primary name；
- Work 日文原题与番号；
- 人物、Maker/Label、Series、Genre 引用完整；
- 正式 Person / Work / Organization / Series 必须有 `sources/<id>.json`；
- Community Data 不允许 MediaFile、Presentation Preference、用户 Tag、私人 Evidence；
- 当前 Community Data 不携带图片 Asset。

Community 仓库自己的 `pnpm check` 仍然是发布前最终权威；主项目 Validator 的作用是**安装前防线**，不是取代数据仓库 CI。
