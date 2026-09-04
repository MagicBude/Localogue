# V1-23 教材：从 Desktop Evidence 到可恢复 Canonical Commit

## 1. 为什么 Desktop 不能只复制 `/review`

Review 页面只是治理流程的表现层。真正重要的是：Evidence 不可变、Decision 可重算、Commit Plan 有 fingerprint、写入前有 Snapshot、失败能恢复、历史 Receipt 不被擦除。

因此 V1-23 的复用层次是：

```text
Desktop React
   ↓
Application Review / Curation / Provenance
   ↓
TauriLibraryRepository + Desktop Vocabulary Repository
   ↓
Tauri Native Audit / Snapshot Commands
   ↓
Private Library
```

## 2. NFO 的两条入口

本地 NFO 仍保留“直接 Bootstrap”用于首次建立私人资料库，同时新增“保存为 Evidence”。后者只写 Evidence，不写 Canonical：

```text
NFO Preview → Evidence → Review → Commit Plan → Snapshot → Commit
```

来源冲突、已有实体补全和需要解释的更新应优先走治理链。

## 3. 为什么 Commit Plan 要重新计算

用户看到 Plan 后，Library 可能已经被另一项操作修改。执行前再次计算 fingerprint，如果与预览时不同，就拒绝旧计划，要求重新 Review。

V1-23 把 fingerprint SHA-256 从 Node `crypto` 改为浏览器中立实现，使共享 Application Service 可以直接运行在 Tauri WebView。

## 4. Snapshot 如何控制范围

Rust 不接受任意 Snapshot 路径。它只根据 Operations 推导：

- works / people / organizations / series / genres / tags；
- 对应 `provenance/<work>.json`；
- 对应 `evidence-lifecycle/<evidence>.json`。

Restore 再次验证每个 relativePath，防止 Snapshot 被篡改成目录穿越。

## 5. Portable Pack 为什么需要临时安装目录

Shared Pack 如果边写边校验，最后一个文件失败就会留下“看起来存在、实际损坏”的目录。V1-23 改成：

```text
Envelope Preview
  → Native temp directory
  → write allowed files
  → inspect_shared_pack
  → verify id/version
  → rename to packs/<id>-<version>
```

Personal Backup 不能整体 rename，因为目标是已有 Private Library，所以记录本轮创建文件；中途失败只删除这些新文件，不覆盖已有内容。

## 6. Curation 为什么继续是派生视图

Completeness 和 Duplicate Candidate 不是 Canonical 真相，只是从当前 Library 派生的治理信号。Desktop 直接复用 Web Application Service，不创建第二套状态文件。

## 7. 下一步

V1-23 完成 Governance 基线后，后续可以继续补 Presentation Preference Workbench、更丰富的人物 Asset 管理、Community Pack 更新与更强 Merge Plan，而不需要再次改变 Evidence / Commit / Snapshot 的核心边界。
