# Localogue 项目状态

## 当前阶段

**V1-09：实例设置中心、Shared Pack 与 Local Override 数据分层。**

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

### 资料导入与治理

- `/import` JSON / NFO / CSV / XLSX 导入工作台；
- Importer Registry 与 Parser → Normalizer → Validator 分层；
- Raw / Normalized 对照预览与解析警告；
- Evidence 文件写入；
- `/review` Evidence Inbox；
- Work 番号精确识别；
- Person 全姓名类型精确匹配；
- Maker / Label / Series / Genre / Tag / Work Type 匹配；
- 字段级 `same / different / evidence_only / library_only` 对照；
- 字段级 `保留 Library / 采用 Evidence` 决策；
- 实体级 `使用匹配 / 绑定已有 / 创建新实体 / 跳过` 决策；
- Commit Plan 与 SHA-256 fingerprint 过期计划检查；
- 默认 Demo 模式禁止正式写库；
- 私人 Library 模式可创建 / 更新 Canonical JSON；
- Evidence 生命周期 `pending / committed / ignored`，生命周期与 Evidence 本体分离；
- Inbox 支持按生命周期筛选；
- ignored Evidence 禁止生成或执行 Canonical Commit。

### Provenance、历史与恢复

- Work 字段级 append-only Provenance；
- 作品详情页显示当前字段来源；
- `/history` Canonical Commit History；
- `/history/[id]` 查看完整 Operations、Evidence、fingerprint、Snapshot 与 Provenance；
- V1-07 Commit Receipt 升级为 schemaVersion 2，保存 `operations` 与 `snapshotId`；
- 正式 Commit 前创建最小 Canonical Snapshot（before-image）；
- Commit 中途失败自动恢复 Snapshot；
- 用户主动恢复时保留审计历史并新增 Restore Receipt；
- 恢复后 Evidence 自动回到 pending，可重新审核；
- 只允许按同一 Work 的最新有效 Commit 逐步恢复；
- 新建实体若已被其他 Work 引用，则阻止危险恢复；
- Snapshot 路径校验防止目录穿越；
- 新增 `pnpm validate:audit` 检查审计数据引用完整性；
- `pnpm check` 同时执行 Canonical 数据与 Audit 数据检查。

### V1-08 资料治理

- Work / Person 可解释完整度评分；
- `/curation` 治理首页；
- 缺标题、日期、时长、演员、封面、人物简介等缺失项队列；
- `/curation/evidence` pending / ignored Evidence 批量治理；
- `/people/[id]/edit` 人物资料手工编辑；
- 日中英姓名、别名/旧艺名、状态、出生资料、三围、简介、职业事件编辑；
- Person 手工编辑 before/after Receipt 与失败补偿恢复；
- `/curation/duplicates` Work / Person 可解释重复候选；
- 完整度等级与重复候选置信级别中日英受控词表。


### V1-09 设置与共享资料层

- 新增 `/settings` 实例设置中心；
- 新增 `.localogue/settings.json` 本机配置文件并 Git 忽略；
- `/settings` 可配置私人 Canonical Library 路径；
- `LOCALOGUE_LIBRARY_PATH` 继续保留最高优先级，适合 Docker / NAS / 服务器部署；
- 新增 Shared Pack 目录协议与 `localogue-pack.json` manifest；
- `/settings` 支持配置多个 Shared Pack，并显示有效/无效状态；
- JSON Repository 支持多根只读合并；
- 读取优先级固定为 `Private Library > Shared Pack（配置顺序）`；
- 同一稳定 ID 由更高优先级数据源的完整实体覆盖；
- Shared Pack 永远只读，Canonical 写入只进入私人 Library；
- Demo 仅在没有任何真实数据源时启用，避免虚构数据混入真实资料；
- CLI `validate:data / validate:audit / library:init` 开始识别网页实例设置；
- 新增 Community Data、Shared Pack、Local Override 与许可边界文档。
- 新增跨用户稳定实体 ID 规则和 Local-First 管理接口安全部署边界。

## 下一阶段建议

**V1-10：Asset、MediaFile 与 Presentation Preference。**

1. Asset 上传/登记、SHA-256 与图片尺寸；
2. 人物头像、作品封面/海报/剧照管理；
3. 本地 `preferredPortrait / preferredCover` 显示偏好层；
4. Shared Pack Asset 读取与本地 Asset 覆盖；
5. MediaFile 目录扫描；
6. ffprobe 媒体时长、分辨率、编码信息；
7. Work ↔ MediaFile 绑定审核。

## 当前不做

- SQLite；
- 在线爬虫与 Provider；
- 外部 API Connector；
- AI Agent；
- 浏览器播放器；
- 自动搬移用户媒体文件；
- Importer 绕过 Review 直接修改正式资料；
- 绕过 Commit Plan / fingerprint 的直接 Canonical 写入；
- 把 JSON Snapshot 宣称为真正 ACID Transaction。
