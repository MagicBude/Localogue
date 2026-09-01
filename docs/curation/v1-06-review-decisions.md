# V1-06：字段级审核决策

## 1. 为什么不能只有“确认导入”按钮

Evidence 与 Canonical Library 出现差异时，“确认导入”这个动作过于含糊。

例如：

- Evidence 时长：130 分钟
- Canonical Library 时长：128 分钟

用户真正要做的是明确回答：

- 保留资料库的 128；或
- 采用 Evidence 的 130。

因此 V1-06 把审核决策拆成两类：

1. **Field Decision**：字段采用谁的值；
2. **Entity Decision**：来源字符串应该绑定哪个 Canonical Entity。

## 2. Field Decision

当前支持：

- `keep_library`：保留 Canonical Library；
- `use_evidence`：采用 Evidence。

对于 `library_only` 字段，默认保留资料库；对于 `different` / `evidence_only`，默认采用 Evidence，但仍必须经过 Commit Plan 和最终确认。

## 3. Entity Decision

当前支持：

- `use_match`：使用唯一精确匹配结果；
- `bind_existing`：人工指定歧义候选中的已有实体；
- `create_new`：建立新的 Canonical Entity；
- `skip`：本次不建立该关系。

### 歧义不能自动处理

`ambiguous` 和 `unresolved` **没有默认决策**。

用户必须明确选择：

- 绑定某个候选；
- 新建实体；
- 或明确跳过。

如果没有选择，Commit Plan 会产生 blocker。

## 4. Work Type 为什么不能随便新建

Work Type 是受控词表，不是普通用户 Tag。

因此当导入值无法映射到 `resources/vocabularies/work-types.json` 时，V1-06 不允许临时生成新的 Work Type ID。默认会跳过并显示提醒。

这能避免 `VR作品`、`VR`、`virtual_reality` 被慢慢制造成三个不同类型。

## 5. Genre 与 Tag 的差异

V1-06 允许用户明确确认后新建 Genre，但会生成治理提醒；后续仍可在词表治理中合并或映射。

Tag 属于用户自己的整理标签，因此新建限制更宽松。
