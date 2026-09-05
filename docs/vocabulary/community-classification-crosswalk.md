# Community Classification Crosswalk

Localogue 主仓库不会复制 `localogue-community-data` 的真实公共实体成为第二份真相，但受控词表属于程序语义，因此可以建立稳定 Crosswalk。

V1-25A 对 Community v0.3.1 的 **323 条 classification 做到 323 / 323 明确分流**：

| 目标 | Community 行数 | 说明 |
|---|---:|---|
| Genre | 264 | 多个 facet 中同名项目会汇聚到同一 Canonical Genre ID |
| Work Type | 38 | production 35 条 + theme 中的 单体 / 企画 / 共演 3 条 |
| Source-only | 21 | lifecycle 5 + media 13 + rating 3 |

因此“323 条来源分类”并不意味着 Localogue 应产生 323 个 Genre。经过去重与语义分流后，Community 本身贡献 **255 个唯一 Canonical Genre 语义**。

机器可读文件：

- `resources/vocabularies/community-classification-crosswalk.json`
- `resources/vocabularies/community-classification-crosswalk.csv`

每行保留：

- `communityId`；
- 原 facet / assignmentTarget；
- 原日中英名称；
- Localogue `targetKind / targetId`；
- 分流 decision。

这份表以后可以直接用于 Community Pack / Provider 导入：若来源已经给出稳定 Community classification ID，可跳过文本猜测，精确落到 Localogue Canonical。
