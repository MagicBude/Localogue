# Localogue V1-23 Manifest

## Desktop Governance Parity I

V1-23 把 Web 已经稳定的资料治理核心带入 Tauri Desktop，但不复制第二套领域规则。Desktop 通过共享 Review / Commit Plan / Curation 服务和受限 Native Audit I/O 完成 Evidence → Review → Commit → History / Restore 日常治理闭环。

## 本阶段完成

- Desktop 新增一级「治理 / Governance」工作台。
- Evidence Inbox 支持 pending / committed / ignored 生命周期筛选。
- Evidence Detail 支持字段决策、实体决策、重新生成 Commit Plan、Blocker / Warning / Operation 预览和显式 Commit。
- Commit Plan SHA-256 指纹改为平台中立 WebCrypto，实现 Web / Desktop 共用，不再依赖 `node:crypto`。
- Canonical Commit 前写最小 Snapshot；任一步失败时 Native Snapshot Restore 自动回滚。
- Commit Receipt、Evidence Lifecycle、Snapshot、Provenance 全部写入 Private Audit 集合。
- Curation 页复用共享完整度和重复候选服务，可直接跳到 Work / Person。
- History 支持 Commit / Snapshot / Restore Receipt 读取，并只允许恢复同一 Work 的最新有效 Commit。
- Restore 继续执行引用阻塞、确认码、Guard Snapshot 和 Provenance 追加。
- Rust 新增受限 Private Audit Reader 与 Snapshot Restore；路径只能是明确白名单中的 `<collection>/<id>.json`。
- Evidence 在 Native Writer 边界保持不可变：已有 Evidence 不允许覆盖。
- Desktop / Rust / Tauri Permission / Generated ACL 的 Governance 命令白名单同步进入 Validator。

## Portable Pack 边界

V1-23 的 Desktop Governance 页提供 Portable Pack 入口，但二进制 `.localogue-pack` 导入 / 导出仍复用现有 Web Workbench。原因是 Web 已经拥有完整 Archive Codec / Community Validator；本阶段不在 Tauri WebView 中再复制一套归档协议。Native Open / Save / Drag & Drop Portable Pack 工作流进入 V1-24。

## 不变式

- Shared Pack 继续 Native 强制只读。
- Governance 写操作只落当前 Desktop Settings 指定的 Private Library。
- Evidence 本体不可变；状态写 `evidence-lifecycle`。
- Canonical 写入必须经过 Commit Plan，不能直接把 Evidence 覆盖到 Library。
- Snapshot Restore 只允许已批准集合，拒绝路径穿越。
- V1-18 Hotfix 3 的 Unified Library / Native I/O / Windows Scanner 不修改。
- V1-22 的 Presentation / Vocabulary 规则不修改。

## 本机验收

```bash
pnpm install
pnpm check
pnpm desktop:rust:check
pnpm desktop:dev
```

重点验证：

1. 左侧出现「治理」入口；
2. Evidence Inbox 能读取 Private `evidence/`；
3. Review 决策能生成 Commit Plan；
4. 有 blocker 时不能 Commit；
5. Commit 后 Evidence 进入 committed，History 出现 Commit / Snapshot；
6. 最新有效 Commit 可按作品番号确认后 Restore；
7. Restore 后 Evidence 回到 pending；
8. Shared Pack 文件不被 Governance 写入。
