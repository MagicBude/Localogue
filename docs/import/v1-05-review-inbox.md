# V1-05 Evidence Inbox 使用说明

## 入口

顶部导航：

```text
审核
```

对应：

```text
/review
```

## 推荐测试方式

V1-05 新增：

```text
examples/imports/sample-existing-work.json
```

它使用虚构番号：

```text
DEMO-001
```

该番号已经存在于公开 Demo Library 中，但示例 Evidence 的时长故意改成 130 分钟，因此可以看到：

```text
已有作品 · 存在差异
```

测试步骤：

1. 打开 `/import`；
2. 上传 `sample-existing-work.json`；
3. 生成预览；
4. 保存为 Evidence；
5. 点击“打开 Evidence 审核箱”；
6. 在 `/review` 打开这条记录；
7. 查看时长、实体匹配和字段对照。

原来的 `sample-work.json` 使用不存在的番号，可用于观察：

```text
新作品候选
```

## 当前限制

V1-05 只分析，不会：

- 新建正式 Work；
- 新建 Person；
- 覆盖已有字段；
- 自动合并关系；
- 删除资料库中 Evidence 未提供的字段。

这些属于下一阶段的 Review Decision / Commit Plan。
