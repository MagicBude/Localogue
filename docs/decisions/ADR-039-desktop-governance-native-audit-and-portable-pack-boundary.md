# ADR-039：Desktop Governance 使用 Native Audit / Snapshot 边界，Portable Pack 使用事务式安装

## 状态

Accepted · V1-23

## 背景

Web 已经具备 Evidence、Review、Commit Plan、Snapshot、History/Restore、Curation 和 Portable Pack。Desktop 如果只复制页面，却让 WebView 直接获得任意 Private Library 路径写权限，会破坏 Localogue 一直坚持的 Local-First 安全边界；如果 Commit 没有 before-image，也无法在桌面端安全补偿中途失败。

## 决策

### 1. Governance 业务规则继续复用 Application Core

Desktop 不重写 Entity Resolution、Review Decision、Commit Plan、Completeness、Duplicate Detection 与 Provenance 规则。Tauri UI 只提供状态载体与交互。

### 2. Private Audit 由 Rust 解析写根

`evidence`、`evidence-lifecycle`、`review-commits`、`snapshots`、`restore-receipts`、`provenance` 和 `media-binding-receipts` 是受控 Private Audit 集合。WebView 只能传 collection + entity，不能传任意 library root。

### 3. Commit 前创建最小 Snapshot

Native Command 根据 Commit Plan Operations 推导需要保存的 Canonical before-image，并额外保存对应 Provenance 与 Evidence Lifecycle。Snapshot entry 只能落在明确白名单的两级 JSON 相对路径。

### 4. Restore 不删除历史

Restore 恢复 Snapshot 内容，但 Commit Receipt 保留。Desktop 追加 Restore Receipt 与 restored Provenance，使“发生过什么”仍可审计。

### 5. Commit fingerprint 必须 WebView 可运行

共享 Commit Plan 不允许依赖 `node:crypto`。V1-23 使用浏览器中立、确定性的同步 SHA-256，以保证 Web / Desktop 对同一计划得到一致 fingerprint。

### 6. Portable Pack 不是任意压缩包解压器

Portable Pack 继续使用 V1-11 gzip JSON Envelope。Desktop Native 层只允许 Personal 白名单目录，或 Shared 的 `library/`、`sources/`、`localogue-pack.json`。

Personal Import 失败时删除本轮创建的文件；Shared Import 先进入临时目录，校验完成后 rename 到正式目录。这样错误包不会留下半安装状态。

## 结果

- Desktop Governance 与 Web 共用 Domain/Application 规则；
- Native Boundary 掌握真正文件写权限；
- Shared Pack 只读不变量不变；
- 失败可恢复，历史可追踪；
- Portable Pack 可以跨机器迁移，但不会演变成通用文件写入口。
