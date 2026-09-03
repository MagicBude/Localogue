# V1-22 Hotfix 3 覆盖说明

1. 将 ZIP 内容解压覆盖仓库根目录。
2. **必须手工删除** `V1_22_HOTFIX3_DELETE_FILES.txt` 中列出的三个旧 Source Genre Catalog 文件；ZIP 覆盖无法自动删除已有文件。
3. 运行：

```bash
pnpm install
pnpm check
pnpm desktop:rust:check
pnpm desktop:dev
```

## 本次变化

- Work Detail 顶部 Hero Gallery 不再显示 poster；
- poster 继续用于作品墙 / 列表封面；
- 完整 1271 条外部 Genre 参考表不再进入 Runtime；
- Canonical Genre 收敛为 33 项；
- 新增 67 条人工批准来源别名；
- `デビュー作 / 周年 / ハイビジョン` 等从 Genre 维度移除；
- 重新运行“分类词表审计”可以清理历史误建分类。
