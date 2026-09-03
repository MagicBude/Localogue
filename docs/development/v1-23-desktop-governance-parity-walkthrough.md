# V1-23 Desktop Governance Parity I 实现导读

## 1. 从哪里看

建议按下面顺序阅读：

1. `apps/desktop/src/desktop-governance.tsx` — Desktop Governance UI；
2. `apps/desktop/src/desktop-governance-service.ts` — Desktop 编排层；
3. `src/application/review/commit-plan-service.ts` — Web/Desktop 共用 Commit Plan；
4. `src/application/crypto/sha256.ts` — 平台中立 Fingerprint；
5. `apps/desktop/src/tauri-bridge.ts` — Native Audit / Restore Bridge；
6. `apps/desktop/src-tauri/src/lib.rs` — Rust 白名单和 Snapshot Restore。

## 2. Evidence 为什么不直接改 Work

Evidence 是“来源事实”，Canonical Work 是“当前采用事实”。V1-23 继续遵守：

```text
Evidence
  ↓ analyze
Review Decisions
  ↓
Commit Plan + fingerprint
  ↓ explicit confirm
Snapshot
  ↓
Canonical writes + Provenance + Receipt
```

这样来源信息、人工选择和最终写入都有可解释链路。

## 3. Desktop 为什么要 Native Audit Reader

Web 可以通过服务器端 Repository 读文件；Tauri WebView 不应该获得通用 fs 权限。因此 V1-23 新增的是业务级命令，不是 `readFile(path)`：

- `read_private_audit_collection(collection)`
- `write_private_audit_entity(collection, entity)`
- `restore_private_snapshot(snapshot, includeAuditState)`

Rust 自己解析当前 Private Library，并验证 collection、ID、JSON 最小结构和 Restore 路径。

## 4. Commit / Restore 安全边界

Commit 之前保存最小 before-image Snapshot。失败时自动恢复。用户主动 Restore 时只允许同一 Work 的最新有效 Commit，并先检查新建实体是否已经被其他 Work 引用。

Snapshot Restore 不能包含任意路径，也不能覆盖 Shared Pack。Evidence 本体不参与 Restore 覆盖；Evidence Lifecycle 会回到 pending，之后可以重新 Review。

## 5. Portable Pack 为什么仍然打开 Web

`.localogue-pack` 已在 V1-11 拥有完整 Codec 和 Community Validator。V1-23 先完成 Governance Core，不在 WebView 复制 ZIP/Archive 实现。V1-24 再基于 Platform Port / Native Dialog 提供真正 Desktop 导入导出。
