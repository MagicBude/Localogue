# Localogue V1-07 交付清单

版本：`0.1.7`

主题：**Provenance、Commit History、Evidence Lifecycle 与 JSON Snapshot Recovery**。

## 一、核心新增

### 1. 字段级 Provenance

新增：

```text
src/domain/entities/provenance.ts
src/application/provenance/work-provenance-service.ts
src/infrastructure/provenance/work-provenance-store.ts
```

能力：

- 记录 Work 字段采用哪条 Evidence；
- 保存 sourceType / sourceName / commitId / 时间；
- 恢复时追加 `restored` 事件；
- 作品详情页显示最新字段来源；
- 同一字段历史使用 append-only Event，不覆盖旧来源。

### 2. Commit History

新增：

```text
/history
/history/[id]
```

可查看：

- Work；
- Evidence；
- Commit 时间；
- fingerprint；
- Operations；
- Snapshot；
- Provenance；
- 是否已恢复。

顶部导航新增“历史”。

### 3. Commit Receipt v2

V1-07 新 Receipt：

```text
schemaVersion = 2
operations[]
snapshotId
```

继续兼容 V1-06 `schemaVersion = 1` 旧记录；旧记录可以浏览，但因为没有 Snapshot 不能恢复。

### 4. 最小 Canonical Snapshot

新增：

```text
src/domain/entities/snapshot.ts
src/infrastructure/history/canonical-snapshot-store.ts
```

Commit 前只保存本次将触碰文件的 before-image，而不是复制整个 Library。

Snapshot 同时包含：

- 新/旧 Canonical Entity 文件；
- Work；
- Provenance 审计状态（用于失败自动回滚）；
- Evidence Lifecycle 状态。

### 5. 失败自动恢复

Commit Executor 现在：

```text
Snapshot
→ dependency entities
→ Work
→ Provenance
→ Lifecycle
→ Receipt
```

任意步骤失败时自动恢复 Snapshot，并明确返回失败，不把半提交状态当成成功。

### 6. 用户主动 Snapshot Restore

新增：

```text
src/application/history/restore-service.ts
src/infrastructure/history/restore-receipt-store.ts
src/components/history-restore-workbench.tsx
/api/history/restore
```

恢复安全规则：

- 必须使用私人 Library；
- 必须存在 V1-07 Snapshot；
- 同一 Work 只能从最新有效 Commit 开始恢复；
- 已恢复 Commit 不能重复恢复；
- 本次 Commit 创建的新实体若已被其他 Work 引用，则阻止恢复；
- 输入目标番号后二次确认；
- 成功恢复后保留历史 Commit，不删除 Receipt；
- 新增 Restore Receipt；
- Evidence Lifecycle 恢复为 pending；
- Provenance 追加 restored Event。

### 7. Evidence Lifecycle

新增：

```text
pending
committed
ignored
```

生命周期与 Evidence Raw/Normalized 本体分离。

新增：

```text
src/domain/entities/evidence-lifecycle.ts
src/infrastructure/evidence/evidence-lifecycle-store.ts
src/components/evidence-lifecycle-actions.tsx
/api/review/lifecycle
```

Evidence Inbox 默认显示 pending，可切换：

- 待审核；
- 已归档；
- 已忽略；
- 全部。

ignored Evidence 禁止生成或执行 Commit。

### 8. Audit Validator

新增：

```bash
pnpm validate:audit
```

检查：

- Commit → Evidence；
- Commit → Snapshot；
- Restore → Commit / Snapshot；
- Lifecycle → Evidence / Commit；
- Provenance → Evidence / Commit / Restore；
- Snapshot 相对路径安全。

`pnpm check` 更新为：

```text
validate:data
→ validate:audit
→ lint
→ typecheck
→ build
```

## 二、词表与 Schema

新增受控词表：

```text
evidence-lifecycle-statuses.json / csv / md
provenance-event-types.json / csv / md
```

新增/升级 Schema 示例：

```text
provenance.schema.example.json
canonical-snapshot.schema.example.json
restore-receipt.schema.example.json
evidence-lifecycle.schema.example.json
commit-receipt.schema.example.json  # v2
```

## 三、新增核心文档

```text
docs/architecture/provenance-history.md
docs/curation/evidence-lifecycle.md
docs/storage/snapshot-recovery.md
docs/development/v1-07-provenance-history-walkthrough.md
docs/decisions/ADR-015-evidence-lifecycle-separate-from-evidence.md
docs/decisions/ADR-016-minimal-snapshot-and-latest-first-restore.md
```

并同步：

```text
README.md
AGENTS.md
PROJECT_STATUS.md
CHANGELOG.md
docs/README.md
docs/data-model/provenance.md
docs/import/review-workflow.md
docs/architecture/commit-plan.md
docs/product/roadmap.md
resources/README.md
schemas/README.md
```

## 四、实际验证

开发环境已执行以下独立检查：

- 110 个 TypeScript / TSX 文件语法转译：通过；
- V1-07 Backend 严格 TypeScript 检查：通过；
- History / Review / Work Detail UI 独立 TypeScript 检查：通过；
- 已有 `DEMO-001`：`128 → 130 → Snapshot Restore → 128`：通过；
- adopted Provenance 保留且追加 restored Provenance：通过；
- Restore 后 Evidence `committed → pending`：通过；
- 新 Work + 新实体 Commit → Restore 后删除本次新建实体：通过；
- 新实体被其它 Work 引用时 Restore Blocker：通过；
- Commit / Snapshot / Restore / Provenance / Lifecycle 审计引用校验：通过；
- Canonical Library 引用校验：通过。

最终完整 `pnpm check` 仍需在用户本地已安装依赖的环境中执行。

## 五、下一阶段

建议 V1-08：

- Work / Person 资料完整度；
- 治理队列；
- 人物资料手工编辑；
- 批量 Evidence 治理；
- 重复作品 / 人物候选基础。
