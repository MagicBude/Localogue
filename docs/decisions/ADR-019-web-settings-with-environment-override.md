# ADR-019：网页设置作为默认配置入口，环境变量保留最高优先级

## 状态

Accepted · V1-09

## 决策

Localogue 实例配置保存到 Git 忽略的 `.localogue/settings.json`，普通用户通过 `/settings` 修改。

`LOCALOGUE_LIBRARY_PATH` 环境变量仍然拥有最高优先级。

## 原因

- 普通用户不应依赖手工编辑 `.env.local`；
- Docker / systemd / NAS 部署仍需要环境变量；
- 运维级配置不应被浏览器页面静默覆盖；
- 设置文件不能存进它自己要定位的 Canonical Library。
