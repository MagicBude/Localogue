# Localogue V1-18 Desktop Presentation Parity & Unified Library Sync 覆盖包

这是从 V1-17 升级到 V1-18 的完整仓库覆盖包。

本版重点修复实机验收中的两个缺口：

1. V1-17 即使导入 Asset，Desktop Works 仍然只显示占位符；
2. Media / NFO / 图片分开操作，容易形成“视频已扫描但 Asset 仍为 0”的半同步状态。

V1-18 新增：

- Works 海报墙 / 列表 / 表格三视图；
- Private poster / cover 实际本地渲染；
- Work Detail 首图和 Asset 图片预览；
- 受限 Rust `read_private_asset_bytes`，只允许读取当前 Private `asset-files/`；
- Media 页面“一键同步资料库”；
- 同步顺序固定为 NFO → Asset → Media；
- 保留仅扫描视频、NFO + 图片 Preview / Explicit Import 高级入口。

覆盖后运行：

```bash
pnpm install
pnpm check
pnpm desktop:doctor
pnpm desktop:rust:check
pnpm desktop:dev
```

建议真实验收：Settings 添加共同父目录 → Media 点击“同步资料库” → Asset 计数应增长 → Works 切换三种视图 → 检查 poster → 打开 Work Detail 检查关联图片。

V1-19 再继续 Evidence / Review / Curation / History、完整高级 Facet、Portable Pack 等 Desktop 重治理能力。
