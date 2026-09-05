# 作品类型词表

Work Type 描述作品的**制作 / 发行 / 表现形态**。一个作品允许多个 Work Type，它与 Genre 的内容题材语义分离。

V1-25A 共维护 **43 个 Work Type**：

- `localogue-community-data` production 分类中的 35 个项目；
- `concept_work`：把 Community 的 `企画作品` 从 Genre 语义纠正为作品类型；
- 历史兼容 `other`；
- MetaTube 参考中补充的 `gravure / multi_episode / reissue / simulation / classic / digital_mosaic`。

完整机器可读版本：

- `resources/vocabularies/work-types.json`
- `resources/vocabularies/work-types.csv`

旧版稳定 ID（`solo / co_starring / vr / image_video / compilation / omnibus / best_of / other`）全部保留。

## 代表条目

| ID | 日本語 | 简体中文 | English |
|---|---|---|---|
| `solo` | 単体作品 | 单体作品 | Single-performer Work |
| `co_starring` | 共演作品 | 共演作品 | Co-starring Work |
| `vr` | VR専用 | VR专用 | VR-only |
| `image_video` | イメージビデオ | 写真影像 | Image Video |
| `adult_animation` | 成人向けアニメ | 成人动画 | Adult Animation |
| `independent_production` | 自主制作 | 独立制作 | Independent Production |
| `uncensored` | 無修正 | 无码 | Uncensored |
| `censored` | モザイク | 有码 | Censored |
| `over_four_hours` | 4時間以上 | 4小时以上 | Over Four Hours |
| `gravure` | グラビア | 写真 | Gravure |

Runtime 不再在 TypeScript 中维护另一份硬编码 Work Type 表；`import-classification-normalizer.ts` 直接消费该 JSON，因此更新词表不会再出现“资源文件有、Importer 不认识”的漂移。
