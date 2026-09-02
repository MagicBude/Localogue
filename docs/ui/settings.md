# 设置页

V1-09 已实现 `/settings`。

## 实例级设置

保存在：

```text
.localogue/settings.json
```

该目录由 Git 忽略。

当前支持：

- 私人 Canonical Library 路径；
- Shared Pack 目录列表；
- Shared Pack 顺序优先级；
- 当前生效路径和配置来源显示；
- 环境变量覆盖提示。

## 环境变量

`LOCALOGUE_LIBRARY_PATH` 仍支持，并且优先于网页设置。

适用：

- Docker；
- NAS；
- 服务器部署；
- CI / 自动化环境。

## 浏览器级显示偏好

右上角继续保留：

- UI 语言；
- 元数据优先语言；
- Light / Dark / System。

这些偏好保存在浏览器 Cookie，不属于实例资料路径配置。

## 未来

- Asset 根目录；
- 扫描目录；
- 本地头像/封面 Presentation Preference；
- Pack 安装、更新、导出和备份 UI。
