# V1-22 Manifest · Desktop Information Architecture & Metadata Localization

## 目标

基于 V1-21 实机反馈，修复 Desktop 在筛选 / 切语言时滚动回顶部、Metadata Language 在 Facet 中表现不一致、中文界面继续暴露 Genre / Tag 英文业务标签，以及 Work Detail 信息密度过低的问题；同时接入用户提供的 1271 条 Genre 中 / 日 / 英参考表。

## 已完成

- 新增 `useStableAsyncData`，Works / People / Catalog / Detail 首次加载后改为 stale-while-refresh；
- 筛选、分页和语言变化时保留已有 DOM 高度，不再用矮 LoadingState 替换整页导致 WebView scrollTop 被夹回顶部；
- Work / Person Query 更新时直接同步重置 page=1，避免 query + page 连续触发两次无意义刷新；
- 顶部主语言选择改为默认同时切换 UI + Metadata；仍保留“Metadata Language（高级）”独立覆盖；
- 中文 UI 将 Genre / Tag 用户可见名称统一为“题材 / 标签”；日文为“ジャンル / タグ”，英文为“Genre / Tag”；
- Work Type Facet / Table 不再显示 raw stable id，改用受控 Work Type 三语名称；
- People 状态 Facet / Card 不再显示 `active / retired / hiatus / inactive / unknown` raw enum，改用受控三语名称；
- Genre Facet / Browse / Work Detail / Web Works 使用统一 `localizeGenre`；
- 新增 Source Genre Catalog：1271 条、日文/简中/繁中/英文完整，保留来源、URL/ID 与 note；
- Source Genre Catalog 只作为 localization/reference layer，不自动把 1271 个来源分类晋升为 Canonical Genre；
- Vocabulary Audit 的 unmapped 来源词若命中 Source Genre Catalog，会显示当前 Metadata Language 的词表参考；
- Work Detail 重构为“顶部媒体画廊 + 下方全宽高密度 Metadata Table”；
- 发行日期、时长、演员、导演、Maker、Label、Series、Work Type、题材、标签合并到主信息区；
- 移除 Work Detail 底部独立“分类与标签”大卡片；
- Work 编辑区保持折叠式操作，并缩减闭合状态占用；
- Local Asset 区域缩小卡片与间距，把页面空间优先留给作品核心元数据；
- Web Works / Work Detail / Genre Index 同步使用 Source Genre Catalog 的 Genre 语言补全，保持 Web / Desktop 展示语义一致；
- Desktop Boundary Validator 新增 Source Genre Catalog 数量、三语完整性、Stable Refresh 和 Dense Work Detail 架构校验；
- 新增 ADR-037 与 V1-22 实现导读，固定 stale-while-refresh 与 Source Genre Catalog 的语义边界。

## Source Genre Catalog 边界

用户提供的 `genre.csv` 中虽然有 1271 条跨站分类及完整翻译，但来源站点的 genre/tag 桶可能同时包含技术属性、活动、发行渠道、厂商和真正内容题材。

因此：

```text
Source Genre Catalog
= 翻译 / 来源参考 / 映射候选
≠ 自动 Canonical Genre 白名单
```

真正进入 Canonical Genre 的自动映射仍由 `import-term-mappings` 明确批准。

## 版本

`0.1.22`

## 下一阶段

V1-23 继续 Desktop Governance Parity：Evidence / Review / Commit Plan / Curation / History / Restore / Portable Pack / Presentation Preference Workbench。
