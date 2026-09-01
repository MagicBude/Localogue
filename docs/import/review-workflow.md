# Review 审核流程

Review 是 Localogue 的核心页面之一。

## 列表状态

- 可直接确认；
- 有字段冲突；
- 疑似重复作品；
- 新人物；
- 人物匹配不确定；
- 未映射 Genre；
- 缺少必要字段；
- 资源文件异常。

## 单项审核

应至少展示：

- 当前 Canonical 值；
- 本次导入值；
- 来源；
- 差异；
- 推荐操作。

操作包括：

- 保留现有；
- 采用导入值；
- 合并；
- 新建实体；
- 关联已有实体；
- 忽略。

## 批量审核

对于完全无冲突的新数据，可以支持批量确认，但仍需有导入记录可追溯。


## V1-05 已实现部分

当前代码已经实现：

```text
Evidence Store
  ↓
Evidence Inbox
  ↓
Work 番号匹配
  ↓
Entity Resolution
  ↓
Field Comparison
  ↓
只读 Review 页面
```

尚未实现：

```text
Review Decision
  ↓
Commit Plan
  ↓
Canonical Write
```

因此 V1-05 是“看清差异”的阶段，V1-06 才是“做出并执行决策”的阶段。
