# 测试原则

V1 优先覆盖：

- 番号规范化；
- 日期与时长解析；
- 多语言 fallback；
- 人物名称匹配；
- 受控词表映射；
- WorkQuery 组合筛选；
- 排序稳定性；
- JSON Schema 兼容；
- Import Diff；
- Review 后写入结果。

V2 再增加 Repository Contract Test，确保 JSON Repository 与 SQLite Repository 的行为一致。


## V1-07：审计数据校验

从 V1-07 开始，`pnpm check` 除了校验 Canonical Library 本身，还会执行：

```bash
pnpm validate:audit
```

这个脚本检查 Commit Receipt、Snapshot、Restore Receipt、Field Provenance 与 Evidence Lifecycle 之间的引用关系。它解决的是另一类问题：即使作品、人物之间的关系仍然正确，审计历史也可能因为手工移动或删除 JSON 文件而出现断链。

因此两类校验职责不同：

- `validate:data`：验证当前资料库实体关系是否完整；
- `validate:audit`：验证“这个资料是怎样变成现在这样”的历史链条是否完整。

迁移到 SQLite 后，这些规则会逐步对应到外键、唯一约束、事务与审计表测试。
