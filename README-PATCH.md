# V1-23 覆盖说明

1. 将 ZIP 内容解压覆盖仓库根目录。
2. 如果你已经按 V1-22 Hotfix 3 删除旧 `source-genre-catalog.*` 文件，无需额外删除文件。
3. 运行：

```bash
pnpm install
pnpm check
pnpm desktop:rust:check
pnpm desktop:dev
```

## 本次变化

- 新增 Desktop「治理」一级入口；
- Evidence Review → Commit Plan → Explicit Commit；
- Curation 完整度 / 重复候选；
- History / Snapshot / Restore；
- Private Audit Reader / Writer 白名单与 Native Snapshot Restore；
- Commit Plan SHA-256 改为 WebCrypto，Web/Desktop 共用；
- Portable Pack 二进制导入导出暂时继续打开 Web Workbench，Native Transport 留 V1-24。
