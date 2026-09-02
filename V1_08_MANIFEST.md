# Localogue V1-08 交付清单

版本：`0.1.8`

主题：**资料完整度、治理队列、Evidence 批量治理、人物手工维护与重复候选基础**。

## 一、资料完整度

新增：

```text
src/domain/entities/completeness.ts
src/application/curation/completeness-service.ts
```

Work 与 Person 分别拥有权重总计 100 的可解释规则，并返回：

```text
score
level
checks[]
missingIds[]
```

完整度是派生治理信号，不写入 Canonical Entity；没有 MediaFile 不影响 Work 元数据完整度。

## 二、Curation 工作台

新增：

```text
/curation
```

集中显示：

- Work 补全队列；
- Person 补全队列；
- pending / ignored Evidence 数量；
- Work / Person 重复候选数量；
- 直接进入作品、人物编辑、Evidence 批量治理和重复候选的行动入口。

顶部导航新增“整理 / Curation”。

## 三、Evidence 批量治理

新增：

```text
/curation/evidence
/api/evidence/lifecycle-bulk
src/components/evidence-bulk-workbench.tsx
```

能力：

- 多选 pending Evidence 批量标记 ignored；
- 多选 ignored Evidence 批量恢复 pending；
- 只修改 Evidence Lifecycle，不修改 Evidence Raw / Normalized；
- 写入前确认所有 Evidence 存在；
- JSON 阶段使用 previous lifecycle 做失败补偿恢复。

## 四、人物手工编辑

新增：

```text
/people/[id]/edit
/api/people/[id]
src/components/person-edit-form.tsx
src/application/people/person-edit-service.ts
```

支持编辑：

- 日文正式名；
- 中文映射名；
- 英文 / 罗马字名；
- 别名、旧艺名、其他名称及有效期；
- 在役 / 引退 / 休止等活动状态；
- 出生日期与三语出生地；
- 身高、B/W/H、Cup；
- 日 / 中 / 英简介；
- 出道、引退、复出、休止、改名等职业事件；
- Portrait / Gallery Asset 引用。

安全边界：

- Demo Library 只读；
- 只有配置 `LOCALOGUE_LIBRARY_PATH` 才允许保存；
- HTTP 输入在 Application Service 重新校验；
- Asset ID 必须存在；
- 必须保留日文 primary name；
- 日期保留 year / month / day 精度。

## 五、人物编辑审计

新增：

```text
src/domain/entities/person-edit.ts
src/infrastructure/people/person-edit-store.ts
person-edits/
```

每次修改保存：

```text
before
after
changedFields
editedAt
```

Receipt 写入失败时尝试把 Person 恢复为 before-image。

`pnpm validate:audit` 同步校验 PersonEditReceipt 结构。

## 六、重复候选

新增：

```text
src/domain/entities/duplicate-candidate.ts
src/application/curation/duplicate-detection-service.ts
/curation/duplicates
```

Work 信号：

- 规范化番号完全相同；
- 原始标题 + 发行年份；
- 原始标题 + 共同演员。

Person 信号：

- 任意正式名 / 本地化名 / 罗马字 / 别名 / 旧艺名规范化后精确重叠；
- 同时出生日期一致时提高置信级别。

重复检测只产生候选，V1-08 不提供自动合并。

## 七、受控词表与文档

新增：

```text
resources/vocabularies/completeness-levels.json/csv
docs/vocabulary/completeness-levels.md
resources/vocabularies/duplicate-confidence-levels.json/csv
docs/vocabulary/duplicate-confidence-levels.md
```

新增核心文档：

```text
docs/curation/v1-08-governance-queues.md
docs/development/v1-08-curation-walkthrough.md
docs/development/v1-08-person-editor-walkthrough.md
docs/decisions/ADR-017-completeness-is-derived-signal.md
docs/decisions/ADR-018-person-manual-edit-audit-receipt.md
schemas/person-edit-receipt.schema.example.json
```

并重写/更新：

```text
docs/curation/completeness.md
docs/curation/duplicate-detection.md
README.md
AGENTS.md
PROJECT_STATUS.md
CHANGELOG.md
docs/README.md
docs/product/roadmap.md
resources/README.md
schemas/README.md
docs/decisions/README.md
```

## 八、下一阶段

建议 V1-09：

- Asset 上传 / 登记；
- Cover / Poster 主图选择；
- Asset SHA-256 去重；
- MediaFile 文件夹扫描；
- ffprobe 媒体信息；
- Work ↔ MediaFile 绑定审核。
