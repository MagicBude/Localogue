# JavBus Genre 索引审计（2026-09-11）

本次通过 Windows 网络栈只读读取：

- https://www.javbus.com/genre
- https://www.javbus.com/uncensored/genre

两个页面合计发现 888 个来源条目。V1-28 已保存完整结构化来源证据；按“规范化来源名称 + 页面分类”去重后为 839 组，进一步按名称去重后为 807 个来源词。它们不是完整三语 Canonical 词表。

页面分类统计：主题 131、角色 111、行为 93、玩法 88、服装 75、类别 64、体型 51、场景 39、其他 236。

## 处理边界

这份结果是 Provider 来源审计，不是 Canonical Genre 发布清单。每一行保留来源分区、页面分类、来源 ID、原文、URL 与采集时间。页面出现不等于可以自动创建 Localogue Genre，机器翻译也不能直接成为三语 Canonical 名称。

## 与 JavBoss 的关系

JavBoss 使用 goquery 读取 `.genre-box`，向前寻找最近的 `h4` 分类标题；随后用 OpenCC 把分类和标签名转为简体，按“原名精确匹配 → 简繁规范化匹配”整理数据库中已有标签。未命中的本地标签保持原分类。

Localogue 复用其产品语义，但不照搬数据库副作用：

1. 在线采集只生成 Provider Evidence；
2. 按来源名称和页面分类分组，并保留有码/无码页面中的全部 occurrence；
3. Provider ID 指向多个名称或分类时记录 `conflicts`，不采用 last-write-wins；
4. 使用受控词表离线分析 Genre / Work Type / Source-only / Review / Unmapped；
5. 未映射词完整保留，等待人工审核。

本次发现 JavBus 自身的 `censored:hd` 同时指向“高清 / 类别”和“縛り / 其他”，因此明确保留为来源冲突。

## 保存位置

- `resources/provider-evidence/javbus/genre-index.raw.json`：888 条来源记录；
- `resources/provider-evidence/javbus/genre-category-map.json`：839 个名称/分类组合及冲突；
- `resources/provider-evidence/javbus/genre-category-map.csv`：便于人工筛选的镜像；
- `resources/provider-evidence/javbus/genre-routing-audit.json`：对当前 Localogue 词表的路由结果。

V1-28 路由结果：184 Genre、12 Work Type、10 Source-only、12 Review、1 Ambiguous、588 Unmapped。

## 后续调用

主动联网刷新并重新生成路由审计：

```bash
pnpm vocabulary:javbus:refresh
```

只基于已保存快照重新计算路由：

```bash
pnpm vocabulary:javbus:routing
```

离线校验来源证据：

```bash
pnpm validate:javbus-evidence
```

采集器还支持 `--input <先前终端 JSON> --write`，用于网络中断后从已成功取得的候选结果重建正式快照。

采集脚本位于 `scripts/audit-javbus-genres.mjs`。默认只输出预览，只有显式传入 `--write` 才原子更新 Provider Evidence；任何模式都不写入 `data/library`、Shared Pack 或 Canonical Genre。
