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

V1-24 后 Review 示例直接和标准 Dev Fixture 联动，不再依赖旧 `DEMO-001`。

先准备 Fixture：

```bash
pnpm desktop:demo:reset
```

Web / Desktop 使用 `var/dev-fixture-library/` 后，导入：

```text
examples/imports/sample-existing-work.json
```

它使用虚构番号：

```text
LX-101
```

`LX-101` 已存在于 Dev Fixture。Canonical 时长是：

```text
118
```

而示例 Evidence 故意写成：

```text
121
```

因此可以稳定看到：

```text
已有作品 · 存在差异
```

测试步骤：

1. 运行 `pnpm desktop:demo:reset`；
2. 将当前实例 Private Library 指向 `var/dev-fixture-library/`；
3. 打开 `/import`；
4. 上传 `examples/imports/sample-existing-work.json`；
5. 生成预览；
6. 保存为 Evidence；
7. 点击“打开 Evidence 审核箱”；
8. 在 `/review` 打开这条记录；
9. 查看 `durationMinutes`、实体匹配和字段对照。

`examples/imports/sample-work.json` 使用不存在的 `LX-404`，但沿用 Dev Fixture 的人物 / Maker / Label / Series / Vocabulary 名称，可用于观察：

```text
新作品候选
+
已有实体解析
```

## 当前限制

V1-05 只分析，不会：

- 新建正式 Work；
- 新建 Person；
- 覆盖已有字段；
- 自动合并关系；
- 删除资料库中 Evidence 未提供的字段。

这些属于后续 Review Decision / Commit Plan；当前 Desktop V1-23+ 已经在治理链中继续实现这些能力。
