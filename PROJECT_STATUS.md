# Localogue 项目状态

## 当前阶段

**V1-06：Review Decision、Commit Plan 与 Canonical JSON 正式归档。**

V0 设计规范仍是架构基线；V1 继续使用 JSON 作为文件化 Canonical Library，SQLite 仍计划在 V2 引入。

## 已完成

### 资料探索

- Domain Model 与 JSON Repository；
- 三语 UI / 元数据语言回退；
- Light / Dark / System 主题；
- 作品库、作品详情、人物库、人物详情；
- 演员、导演、Maker、Label、Series、Genre、Work Type、Tag、年份、日期范围、时长、封面、本地媒体组合筛选；
- self-excluding Facet 动态计数；
- 海报墙、列表、表格三种视图；
- 已选条件 Chips；
- 作品 / 人物 URL 分页；
- 人物状态、出生 / 出道 / 引退年份、身高范围与排序；
- Maker / Label / Series 详情页与关系导航；
- 筛选侧栏响应式修复；
- 视图切换和“应用筛选”均保持合理滚动位置。

### 资料导入

- `/import` 导入工作台；
- JSON 文件 / 粘贴 JSON 预览；
- NFO 文件预览；
- CSV 文件预览；
- XLSX 文件预览；
- Importer Registry；
- Parser → Normalizer → Validator 分层；
- Raw / Normalized 对照预览；
- 解析警告；
- Evidence 文件写入；
- 真实导入默认写入 `data/library`，不修改 Demo Library；
- Importer 不直接修改 Canonical Work / Person；
- `/review` Evidence Inbox；
- 单条 Evidence 审核详情；
- 按番号精确识别已有 Work；
- Person 全姓名类型精确匹配；
- Maker / Label / Series / Genre / Tag / Work Type 匹配；
- 字段级 `same / different / evidence_only / library_only` 对照；
- Review Analysis 本身保持只读；
- 字段级 `保留 Library / 采用 Evidence` 决策；
- 实体级 `使用匹配 / 绑定已有 / 创建新实体 / 跳过` 决策；
- 歧义实体无默认决策，未处理时阻塞 Commit；
- Commit Plan 预览；
- SHA-256 fingerprint 过期计划检查；
- 默认 Demo 模式禁止正式写库；
- 私人 Library 模式可正式创建/更新 Canonical JSON；
- 写入顺序采用“依赖实体 → Work → Commit Receipt”；
- Evidence 已归档状态留痕。

## 下一阶段建议

**V1-07：Provenance、提交历史与可恢复性。**

1. 保存字段级 Provenance / Field Resolution；
2. Commit Receipt 展示与历史页；
3. JSON Commit 前快照与恢复工具；
4. Evidence 生命周期状态（待审核 / 已归档 / 已忽略）；
5. 批量审核基础；
6. Canonical Library 资料完整度重新计算。

## 当前不做

- SQLite；
- 在线爬虫与 Provider；
- 外部 API Connector；
- AI Agent；
- 浏览器播放器；
- 自动搬移用户媒体文件；
- Importer 绕过 Review 直接修改正式资料；
- 绕过 Commit Plan / fingerprint 的直接 Canonical 写入。
