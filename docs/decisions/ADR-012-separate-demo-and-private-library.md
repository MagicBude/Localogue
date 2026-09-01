# ADR-012：公开 Demo 数据与私人资料库物理隔离

- 状态：接受
- 日期：2026-09-01

## 背景

Localogue 本身会使用 Git / GitHub 管理源码，但用户的真实媒体元数据、人物资料和本地文件路径属于个人资料，不应因为一次 `git add .` 被误提交。

如果演示数据和真实数据都放在 `data/library/`，使用者很容易在测试后直接把真实 JSON 混进源码仓库。

## 决策

公开虚构 Demo：

```text
data/demo-library/
```

真实本地资料默认位置：

```text
data/library/
```

`data/library/*` 默认进入 `.gitignore`，只保留目录占位文件。

运行时可通过：

```text
LOCALOGUE_LIBRARY_PATH
```

指向其他路径，包括仓库外目录或未来的独立数据盘。

## 结果

- 克隆仓库后无需私人数据即可看到完整 Demo；
- 源码和用户资料默认隔离；
- 后续切换 NAS / 自定义资料目录无需改变页面代码；
- 降低把私人收藏意外推送到 GitHub 的风险。
