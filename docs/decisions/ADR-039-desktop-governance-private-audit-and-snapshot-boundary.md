# ADR-039：Desktop Governance 复用共享 Review Core，并通过受限 Private Audit / Snapshot Native Boundary 写入

## 状态

Accepted — V1-23

## 背景

Web 已经拥有 Evidence → Review → Commit Plan → Canonical Commit → Snapshot / History / Restore 的治理规则。Desktop 若重新实现第二套匹配、Fingerprint 或 Restore 逻辑，会很快与 Web 漂移；但 Tauri WebView 又不能获得任意文件系统写权限。

## 决策

1. Review、Entity Resolution、Commit Plan、Curation 等领域逻辑继续放在 `src/application/`，Web / Desktop 共用。
2. Commit Plan Fingerprint 使用平台中立 WebCrypto SHA-256，而不是 `node:crypto`。
3. Desktop 只通过明确白名单的 Native Commands 读写 Private Audit：`evidence`、`evidence-lifecycle`、`review-commits`、`snapshots`、`restore-receipts`、`provenance`、`media-binding-receipts`。
4. Evidence 是不可变输入；已有 Evidence ID 不允许覆盖，状态变化只写 lifecycle。
5. Restore 不允许 WebView 直接提供任意目标路径。Rust 只接受 Snapshot 中一层 `<collection>/<file>.json` 路径，并仅恢复 works / people / organizations / series / genres / tags / evidence-lifecycle / provenance。
6. Restore 前后均保留审计记录；Canonical Commit 失败时用 Snapshot 自动回滚。
7. Portable Pack 二进制归档在 V1-23 继续复用 Web Workbench，避免复制 Archive Codec；Native 传输 UI 留 V1-24。

## 结果

Desktop 获得真实治理闭环，同时保持 Local-first、Shared-read-only、Evidence immutable 和最小 Native 权限边界。后续治理功能应继续扩共享 Application Core，而不是在 WebView 内直接读写 JSON。
