# 架构决策记录（ADR）

ADR 用于记录“为什么这样设计”，避免未来只看到结果而不知道原因。

- [ADR-001：Local First](ADR-001-local-first.md)
- [ADR-002：Canonical Library](ADR-002-canonical-library.md)
- [ADR-003：V1 JSON，V2 SQLite](ADR-003-json-before-sqlite.md)
- [ADR-004：日文原文优先](ADR-004-original-language-first.md)
- [ADR-005：Work 与 MediaFile 分离](ADR-005-work-mediafile-separation.md)
- [ADR-006：Evidence 不直接写正式资料](ADR-006-evidence-not-direct-write.md)
- [ADR-007：Faceted Navigation 为一级能力](ADR-007-faceted-navigation.md)
- [ADR-008：Work Type / Genre / Tag 分离](ADR-008-classification-separation.md)
- [ADR-009：Person 统一人物模型](ADR-009-person-model.md)
- [ADR-010：默认非破坏性文件管理](ADR-010-non-destructive-storage.md)

- [ADR-011：V1 优先单一 Next.js 应用](ADR-011-single-app-before-monorepo.md)
- [ADR-012：公开 Demo 与私人资料库隔离](ADR-012-separate-demo-and-private-library.md)

- [ADR-013：V1 实体匹配采用保守的规范化精确匹配](ADR-013-conservative-exact-entity-resolution.md)
- [ADR-014：正式写入前必须经过 Commit Plan](ADR-014-explicit-commit-plan-before-canonical-write.md)

- [ADR-015：Evidence 生命周期与 Evidence 本体分离](ADR-015-evidence-lifecycle-separate-from-evidence.md)
- [ADR-016：最小 Snapshot 与最新提交优先恢复](ADR-016-minimal-snapshot-and-latest-first-restore.md)


### V1-08
- [ADR-017：完整度是派生治理信号](ADR-017-completeness-is-derived-signal.md)
- [ADR-018：人物手工编辑必须保留 before/after Receipt](ADR-018-person-manual-edit-audit-receipt.md)


### V1-09
- [ADR-019：网页设置作为默认配置入口，环境变量保留最高优先级](ADR-019-web-settings-with-environment-override.md)
- [ADR-020：Shared Base 只读，本地稳定 ID 覆盖优先](ADR-020-shared-base-local-override.md)

- [ADR-021：展示偏好不得强迫复制 Shared Entity](ADR-021-presentation-preference-does-not-copy-shared-entity.md)
- [ADR-022：MediaFile 永远属于 Private Layer](ADR-022-mediafile-is-private-only.md)

### V1-11
- [ADR-023：Portable Pack 是传输容器，不是新的资料模型](ADR-023-portable-pack-is-transport-container.md)
- [ADR-024：MediaFile 人工绑定必须显式并保留审计记录](ADR-024-mediafile-manual-binding-is-audited.md)

### V1-12
- [ADR-025：先建立 Platform Ports，再引入 Tauri Shell](ADR-025-platform-ports-before-tauri-shell.md)
- [ADR-026：Snapshot Diff 是扫描基线，Filesystem Watcher 只是增强](ADR-026-snapshot-diff-before-filesystem-watcher.md)


### V1-13
- [ADR-027：Web 与 Tauri Desktop 并存，而不是互相替代](ADR-027-web-and-desktop-coexist.md)
- [ADR-028：Tauri Webview 只获得最小业务命令，不开放通用 Shell](ADR-028-tauri-minimal-command-surface.md)

### V1-14
- [ADR-029：Desktop 复用 Media Scan Application Core](ADR-029-desktop-reuses-media-scan-core.md)

### V1-15
- [ADR-030：Web 与 Desktop 共享 Library Query Core](ADR-030-shared-query-core-for-web-desktop.md)


### V1-16
- [ADR-031：NFO 元数据目录与媒体目录解耦](ADR-031-independent-nfo-metadata-roots.md)
