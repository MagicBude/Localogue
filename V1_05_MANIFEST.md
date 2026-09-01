# Localogue V1-05 Manifest

## 阶段名称

**Evidence Inbox、实体匹配与差异审核基础**

## 新增核心代码

```text
src/domain/entities/review.ts
src/application/review/entity-resolution-service.ts
src/i18n/review.ts
src/app/review/page.tsx
src/app/review/[id]/page.tsx
```

## 修改核心代码

```text
src/infrastructure/evidence/evidence-store.ts
src/components/site-header.tsx
src/components/import-workbench.tsx
src/i18n/ui.ts
src/app/globals.css
```

## 新增示例

```text
examples/imports/sample-existing-work.json
```

该示例用于演示同番号已有作品的字段差异。

## 新增受控词表

```text
resources/vocabularies/review-work-statuses.json / .csv
resources/vocabularies/entity-resolution-statuses.json / .csv
resources/vocabularies/field-comparison-statuses.json / .csv
```

三个词表均提供日本語 / 简体中文 / English 对照。

## 新增文档

```text
docs/curation/v1-05-review-analysis.md
docs/development/v1-05-entity-resolution-walkthrough.md
docs/development/v1-05-evidence-inbox-walkthrough.md
docs/import/v1-05-review-inbox.md
docs/decisions/ADR-013-conservative-exact-entity-resolution.md
```

## V1-05 能力

- Evidence Inbox；
- 单条 Evidence 审核详情；
- 按番号精确检测已有 Work；
- Person 全姓名类型精确匹配；
- Maker / Label 类型约束匹配；
- Series / Genre / Tag / Work Type 匹配；
- `matched / new / ambiguous / unresolved` 解析状态；
- `same / different / evidence_only / library_only` 字段比较；
- Raw / Normalized / Canonical 三层审阅视角；
- 不直接修改 Canonical Library。

## 下一步

V1-06 计划实现：

- Review Decision；
- 字段级“采用 Evidence / 保留 Library”；
- 人物绑定已有实体 / 新建实体；
- 生成 Commit Plan；
- 最终确认后才写 JSON Canonical Library；
- 写入后保留决策记录与 Provenance。
