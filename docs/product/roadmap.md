# 路线图

路线图按可交付产品阶段组织。历史实现细节由 `CHANGELOG.md`、`MANIFEST.md` 和 Git Commit 保存，不再把每个内部编号堆在产品路线图中。

## 已完成的基础

- Domain / Application / Repository 分层；
- Work、Person、Organization、Series、Genre、Tag、Asset、MediaFile 结构化模型；
- Evidence、字段审核、Commit Plan、Provenance、Snapshot 与 Restore；
- Curated Catalog / Personal Library 分层；
- `catalog.db` 只读公共库与 `local.db` 私人库迁移；
- Desktop 多资料库、多目录、统一同步、增量扫描与可观察 Job；
- Desktop 作品、人物、分类、收藏、编辑、治理、备份与委托播放基础；
- 日 / 中 / 英界面与元数据显示；
- JSON / CSV / NFO / Portable Pack 交换能力。

## 当前：0.2 Desktop Beta Readiness

### 0.1.26：文档与产品边界收敛

- 统一仓库介绍、产品定位和当前阶段；
- 把 Desktop 定为正式用户入口；
- 记录 Web 退役和元数据 Adapter 的提议，不提前实现；
- 清理把已完成 SQLite 迁移写成未来工作的陈旧文档。

### 0.1.27：日常闭环验收

- 用隔离资料库完成首次启动、多目录、单目录增量扫描验收；
- 验收作品编辑、筛选、收藏、返回、分页和五种展示；
- 验收日志、错误恢复、备份、导入与恢复；
- 解决 `desktop-ux-audit.md` 中阻断普通使用的问题。

### 0.1.28：发行工程

- 干净 Windows 环境安装、升级、卸载；
- 明确 ffprobe 获取、许可、版本和完整性策略；
- 完成日志定位、崩溃说明、版本展示和发布检查；
- 决定签名、更新通道与发布包策略。

## 0.2.0 Beta

目标是让新用户不读文档也能完成：选择目录 → 查看同步进度 → 处理异常 → 浏览和编辑 → 委托播放 → 备份。

Beta 可以使用本地 NFO、Portable Pack 和手工编辑验证闭环。Windows 是首个实机支持平台；macOS、Linux 和 Docker 在完成验证前不得写成已支持。

## 0.2.0 Stable

除 Beta 验收外，还必须明确元数据获取策略。推荐至少完成一个受控 Adapter 的端到端试点，使采集结果进入 Evidence 而不是直接覆盖 Catalog；如果没有完成，应明确把产品描述为本地资料整理器，不能宣称全链路单一 App。

## 0.3：元数据连接器

- 版本化 Provider Adapter 协议；
- 进程超时、取消、日志、限速和凭据隔离；
- Provider 原始响应与标准 Evidence 保存；
- 多来源冲突、字段置信度与人工审核；
- 第三方许可证与二进制发布策略。

## 更后阶段

- macOS / Linux 桌面发行；
- NAS / Docker 的后台索引形态；
- 经真实需求验证的播放进度、截图书签或播放器集成；
- 可解释的辅助匹配与翻译建议。

通用视频管理、云盘下载、磁力下载、内嵌解码和媒体服务器均不在默认路线内，若未来进入范围必须单独立项和决策。
