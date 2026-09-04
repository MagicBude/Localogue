# 设置页

Localogue 的 Web 与 Desktop 都有设置，但二者承担的运行环境不同。

## Desktop：按资料库配置组织本机路径

V1-24 起 Desktop 不再建议把 Private Library、扫描目录和 Shared Pack 当成互不相关的全局字段理解，而是通过 **Library Profile（资料库配置）** 把它们收拢。

一个 Profile 保存：

- 私人资料库（可写）；
- 内容根目录 / Unified Library Roots（推荐扫描入口）；
- 只读 Shared Packs；
- 高级额外媒体目录；
- 高级额外 NFO / 图片目录。

因此可以建立任意多个资料库。普通新建项默认命名为 `资料库 1`、`资料库 2` 等，由用户自行重命名；开发 Fixture 固定叫 `示例库`。这些资料库都可以从 Desktop 左侧栏快速切换。

完整说明见：

- `docs/desktop/library-profiles-and-sources.md`
- `docs/decisions/ADR-040-library-profiles-group-desktop-sources.md`

`ffprobe` 路径和 Localogue Web URL 属于应用级设置，不随 Library Profile 切换。

## 为什么仍然保留高级目录

推荐用户优先只配置一个或几个“内容根目录”。同一根目录下的视频、NFO、poster / fanart / thumb 会递归发现。

额外媒体目录、额外 NFO / 图片目录只用于兼容历史目录结构，因此在 Desktop UI 中默认折叠。

## Web：实例级设置

Web 的实例设置保存在：

```text
.localogue/settings.json
```

该目录由 Git 忽略。

Web 当前支持 Private Library、Shared Pack、媒体 / NFO 扫描路径等实例字段；环境变量仍可覆盖服务器部署路径。

### 环境变量

`LOCALOGUE_LIBRARY_PATH` 继续支持，并且优先于网页设置。

适用：

- Docker；
- NAS；
- 服务器部署；
- CI / 自动化环境。

## 浏览器级显示偏好

UI 语言、元数据优先语言、Light / Dark / System 属于显示偏好，不属于资料库路径配置。
