# Localogue 项目状态

## 当前阶段

**V1-05：Evidence Inbox、实体匹配与差异审核基础。**

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
- Review Analysis 仍不直接修改 Canonical Library。

## 下一阶段建议

**V1-06：Review Decision 与正式归档计划。**

1. 字段级选择“采用 Evidence / 保留 Library”；
2. 新人物候选明确“新建 / 绑定已有 / 忽略”；
3. 歧义候选人工选择；
4. 生成可预览的 Commit Plan；
5. 最终确认后才写 Canonical JSON；
6. 保存 Review Decision 与字段 Provenance；
7. 写入失败时保证原 Canonical Library 不被部分污染。

## 当前不做

- SQLite；
- 在线爬虫与 Provider；
- 外部 API Connector；
- AI Agent；
- 浏览器播放器；
- 自动搬移用户媒体文件；
- Importer 绕过 Review 直接修改正式资料。
