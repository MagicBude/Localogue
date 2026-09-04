# Localogue Current Manifest

## 阶段名称

**Desktop Governance Parity**

当前版本（0.1.23 / V1-23）的目标不是继续扩张 Desktop 浏览 UI，而是把 Web 已有的资料治理闭环真正带到 Tauri Desktop：来源内容先形成不可变 Evidence，用户在 Review 中逐字段/逐实体决策，生成带 fingerprint 的 Commit Plan，显式提交前由 Native Boundary 保存最小 before-image Snapshot；失败自动恢复，历史页也允许显式 Restore。与此同时，Desktop Packs 页面补齐 Personal Backup / Shared Library Portable Pack 的原生打开、保存、预览、校验与安装。

## 本阶段完成

### Evidence → Review → Commit Plan

- Desktop 新增 Review 一级入口与 Evidence Inbox；
- NFO Preview 可以“保存为 Evidence”，不要求直接 Bootstrap Canonical；
- 复用 Web 的 `analyzeSingleEvidenceRecord`、Review Decision 与 `buildCanonicalCommitPlan`；
- Commit Plan fingerprint 改用浏览器中立的同步 SHA-256，实现不再依赖 `node:crypto`；
- Commit 前重新计算 fingerprint，资料库或决策变化时拒绝执行旧计划；
- 字段决策与实体决策继续保持显式人工确认。

### Native Audit / Snapshot / Restore

- Rust 只允许读取/写入受控 Private Audit 集合：`evidence`、`evidence-lifecycle`、`review-commits`、`snapshots`、`restore-receipts`、`provenance`、`media-binding-receipts`；
- Audit 根路径只能从当前 Desktop Settings 的 Private Library 解析，WebView 不能传入任意写根；
- Commit 前按实际 Operations 创建最小 before-image Snapshot；
- Snapshot 路径只允许受控 Canonical / provenance / lifecycle JSON；
- Commit 中途失败自动 Restore；
- History 页面支持显式 Restore，并追加 Restore Receipt 与 restored Provenance，不删除历史 Commit Receipt。

### Curation

- Desktop 新增 Curation 一级入口；
- 复用 Web `buildCurationOverview`；
- 展示 Work / Person completeness 队列；
- 展示可解释 Work / Person duplicate candidates；
- 可直接回到对应 Work / Person 继续维护。

### Portable Pack

- Desktop Packs 页面新增 `.localogue-pack` 工作台；
- Personal Backup 可通过 Native Save Dialog 导出；
- Shared Pack 可导出为 Shared Library Archive；
- 导入先 Preview、验证路径、大小与 SHA-256，再显式执行；
- Portable Envelope 使用与 Web 同语义的 gzip JSON；
- Personal Backup 默认不覆盖已存在 Private 文件；中途失败会回滚本轮新建文件；
- Shared Pack 先安装到 App Local Data 临时目录，校验 `localogue-pack.json`、id/version 与目录边界后再 rename 到正式目录；失败删除临时目录；
- 同 id/version 的正式安装目录只在现有 Pack 校验有效且 id/version 完全一致时复用；
- 单包继续保持 256 MiB 安全上限；
- Shared Pack 仍然 Native 强制只读。

### Desktop I18N

- Review / Curation / History / Portable Pack 的核心标题、按钮和状态进入 Desktop 中 / 日 / 英翻译表；
- V1-20 的字面量 `t()` 覆盖审计继续生效。

## 安全不变量

1. Shared Pack 永远只读。
2. Evidence 本体保持不可变，生命周期单独记录。
3. Canonical Commit 必须显式生成 Commit Plan，不允许来源导入器静默覆盖。
4. Snapshot / Restore 只能访问 Native 白名单中的 Private JSON 相对路径。
5. Portable Pack 不获得任意文件系统写权限；Personal 只能写 Private 白名单目录，Shared 只能安装 `library/`、`sources/` 与 manifest。
6. V1-18 Hotfix 3 的 Native I/O worker、SHA-256 堆缓冲与 Windows 扫描安全实现保持不变。

## 明确不在 V1-23 冒充完成的内容

- Presentation Preference 的独立 Desktop Workbench；
- 更完整的人物 Asset / Gallery 管理；
- 复杂自动 Merge Plan；
- Community Pack 在线更新/版本检查；
- SQLite 持久化。

这些进入后续 V1.x / V2，不影响本阶段 Governance 基线闭环。

## 版本

`0.1.23`
