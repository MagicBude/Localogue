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

V2 已增加 `pnpm sqlite:repository:validate`。它在 `local.db` 临时副本中验证 SQLite Repository 的查询、查找和私人覆盖语义；由于 Catalog 构建会把旧 Community 混合分类规范化为 Genre / Work Type / Source-only，Contract 验证 Domain 行为与关系完整性，而不是要求旧 JSON 字节完全相等。


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

## V1-12 Platform Boundary

`pnpm check` 现在还会执行：

```bash
pnpm validate:platform
```

它用于保证 Media Scan Application Core 不重新直接依赖 `node:fs`、`node:path`、`child_process` 等 Node 专用模块。

这是一个架构回归检查，不是功能测试：Node 专用实现应该留在 `src/infrastructure/platform/`，未来 Tauri 用另一套 Adapter 实现相同 Ports。

媒体扫描的关键回归用例：

1. 第一次扫描会新增、ffprobe；
2. 第二次完全不变应 `unchanged`，且不再次 ffprobe；
3. 只新增 NFO / Poster 时只更新 Sidecar；
4. `matchMethod=manual` 不能被扫描器覆盖；
5. 视频改变但关闭 Probe 时标记 stale；
6. 同时只允许一个 Scan Job；
7. Cancel 能终止尚未完成的扫描。
