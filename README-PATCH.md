# Localogue V1-15 Desktop Feature Parity I 覆盖包

这是从 V1-14 升级到 V1-15 的完整仓库覆盖包。

V1-15 的重点不是再增加一组 Tauri 测试按钮，而是让 Desktop 正式成为 Localogue 的第二运行入口：

- Home / Works / People / Media / Packs / Settings；
- Work / Person 详情；
- Private + Shared Pack 合并浏览；
- Web / Desktop 共享 Works / People Query Core；
- Shared Pack Native Manifest 校验；
- 媒体扫描继续复用 V1-14 Native Runtime，并允许 Shared Pack Work 参与匹配；
- Canonical 写权限仍保持收敛，只有 Private `media-files` 可写。

覆盖仓库根目录后执行：

```bash
pnpm install
pnpm check
pnpm desktop:doctor
pnpm desktop:rust:check
pnpm desktop:dev
```

详细变化与人工验收步骤见 `V1_15_MANIFEST.md` 和 `docs/development/v1-15-desktop-feature-parity-i-walkthrough.md`。
