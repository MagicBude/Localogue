# Classification Term Aliases

`classification-term-aliases.json/csv` 是 Localogue 对**通用来源分类字符串**的精确匹配表。

它汇总：

- V1-24 之前已使用的 Localogue 显示词；
- `localogue-community-data` Classification 的日 / 中 / 英名称；
- 经人工整理的 MetaTube 日文分类参考词；
- Source-only 分类名称和别名。

当前共登记 **1161 个精确词条**：

- `approved`：1127 条；必须恰好指向一个 `genre:*`、`workType:*` 或 `sourceOnly:*`，允许自动路由；
- `review-required`：34 条；只保存候选，不允许自动写入 Canonical。

V1-25B 新增 FANZA Provider Snapshot 的精确词条；`独占配信`、促销、竖屏推荐等平台属性进入 Source-only，复合来源桶继续保留 Review。

## 核心规则

- 使用 Unicode NFKC、空白 / `_` / `-` 规范化后精确匹配；
- 不做模糊相似自动合并；
- 同一个规范化 Alias 若指向多个不同目标，必须 fail closed，不允许自动选一个；
- Alias 负责“认出它是谁”，Canonical 的 `ja / zh-CN / en` 负责“界面应该显示什么”；
- 外部参考表中的翻译只是 Evidence，不会直接覆盖 Canonical Display Name。

例如：

```text
主観        -> genre:pov
ハメ撮り    -> genre:pov_recording
中出し      -> genre:creampie
単体作品    -> workType:solo
Blu-ray     -> sourceOnly:media_blu_ray
```

复合词示例：

```text
寝取り、寝取られ
女装・男の娘
ベスト、総集編
サイコ、スリラー
```

这些词进入 `review-required`，不会为了追求覆盖率而一次写入多个 Canonical。
