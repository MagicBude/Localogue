# Localogue V1-06 交付清单

## 版本主题

**Review Decision → Commit Plan → Canonical JSON Commit**

V1-06 第一次允许经过人工审核的 Evidence 正式写入 Canonical Library，同时继续保持“默认只读、计划先行、明确确认、可追踪”的安全边界。

## 核心新增

### Review Decision

- 字段级：`keep_library` / `use_evidence`；
- 实体级：`use_match` / `bind_existing` / `create_new` / `skip`；
- `ambiguous` / `unresolved` 无默认动作，必须人工选择；
- Work Type 未映射时不得自动创建受控词表 ID。

### Commit Plan

- 生成只读写入计划；
- 展示目标 Work、操作数量、blockers、warnings；
- 列出准备创建的人物、组织、Series、Genre、Tag；
- 列出 Work 创建或更新操作；
- 计算 SHA-256 fingerprint。

### Canonical Commit

- 默认 Demo Library 禁止写入；
- 仅显式配置 `LOCALOGUE_LIBRARY_PATH` 后允许 Commit；
- 执行前重新读取资料并生成计划；
- fingerprint 不一致时拒绝过期计划；
- 写入顺序：依赖实体 → Work → Commit Receipt；
- Evidence 已执行的 Commit 保存到 `review-commits/`，避免重复提交。

### Repository

新增：

- `saveOrganization()`；
- `saveSeries()`；
- `saveGenre()`；
- `saveTag()`。

### 私人 Library

新增：

```bash
pnpm library:init
```

用于把 Demo Canonical 数据复制到 Git 忽略的 `data/library` 进行安全学习，不覆盖已有 Evidence。

启用私人可写模式：

```text
LOCALOGUE_LIBRARY_PATH=./data/library
```

### 校验脚本

`validate:data` 会尝试读取 `.env.local`，使 CLI 与 Next.js 使用一致的 Canonical Library 路径。

## 新增主要源码

```text
src/domain/entities/commit-plan.ts
src/application/review/review-decision-service.ts
src/application/review/commit-plan-service.ts
src/application/review/commit-executor.ts
src/infrastructure/evidence/review-commit-store.ts
src/infrastructure/repositories/library-path.ts
src/components/review-commit-workbench.tsx
src/app/api/review/plan/route.ts
src/app/api/review/commit/route.ts
src/i18n/commit.ts
scripts/init-private-library.mjs
```

## 新增文档

```text
docs/curation/v1-06-review-decisions.md
docs/architecture/commit-plan.md
docs/development/v1-06-commit-plan-walkthrough.md
docs/development/v1-06-private-library-mode.md
docs/storage/v1-json-commit-safety.md
docs/decisions/ADR-014-explicit-commit-plan-before-canonical-write.md
```

## 新增词表

- Review 字段决策：JSON / CSV / Markdown；
- 实体审核动作：JSON / CSV / Markdown。

## 新增 Schema 示例

- `schemas/commit-plan.schema.example.json`；
- `schemas/commit-receipt.schema.example.json`。

## 建议本地验证

```bash
pnpm check
```

如果要测试正式归档：

```bash
pnpm library:init
```

创建 `.env.local`：

```text
LOCALOGUE_LIBRARY_PATH=./data/library
```

重新启动：

```bash
pnpm dev
```

然后：

1. `/import` 导入 `examples/imports/sample-existing-work.json`；
2. 保存为 Evidence；
3. `/review` 打开 Evidence；
4. 选择字段/实体决策；
5. 生成 Commit Plan；
6. 确认 fingerprint、blockers、warnings；
7. 明确执行 Canonical Commit；
8. 执行 `pnpm validate:data` 再次检查引用完整性。
