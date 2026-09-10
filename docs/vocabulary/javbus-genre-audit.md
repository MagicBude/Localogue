# JavBus Genre 索引审计（2026-09-11）

本次通过 Windows 网络栈只读读取了两个页面：

- `https://www.javbus.com/genre`
- `https://www.javbus.com/uncensored/genre`

两个页面当时合计发现 888 个来源条目（尚非去重后的唯一标签数，也不是完整三语词表导入），按页面标题归纳为 9 个来源分类：

| JavBus 分类原文 | 中文展示 | English presentation | 命中数量 |
| --- | --- | --- | ---: |
| 主題 / 主题 | 主题 | Theme | 131 |
| 角色 | 角色 | Role | 111 |
| 行為 | 行为 | Behavior | 93 |
| 玩法 | 玩法 | Practices | 88 |
| 服裝 | 服装 | Clothing | 75 |
| 類別 | 类别 | Category | 64 |
| 體型 | 体型 | Body type | 51 |
| 場景 | 场景 | Scene | 39 |
| 其他 | 其他 | Other | 236 |

## 处理边界

这份结果是 Provider 来源审计，不是 Canonical Genre 发布清单。JavBus 的标签名称和分类可以作为 Evidence / source-only candidate，但不能因为页面出现就自动创建 Localogue Genre，也不能把机器翻译直接当作三语 Canonical 名称。下一步如果要导入，应提供 Preview → 人工审核 → 显式写入的流程，并为每一行保留来源 URL、抓取时间和原文。

JavBoss 的实现采用同样的来源解析思路：读取 `.genre-box` 前的标题，精确或规范化匹配本地标签；未匹配项保持原状。Localogue 的离线约束意味着该动作只能是用户主动触发的来源审计/映射，不应成为启动时联网任务。

只读审计脚本位于 `scripts/audit-javbus-genres.mjs`，它只输出候选 JSON，不写入 `data/library`、Shared Pack 或 Canonical Genre。
