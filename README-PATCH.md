# Localogue V1-16 Independent NFO Library Ingest 覆盖包

这是从 V1-15 升级到 V1-16 的完整仓库覆盖包。

V1-16 优先解决真实本地资料迁移：**NFO 资料目录与视频目录完全解耦**。

- `mediaScanPaths`：扫描视频并建立 / 更新 Private `MediaFile`；
- `nfoScanPaths`：独立递归扫描 `.nfo` 元数据；
- NFO XML 番号优先，文件名番号作为 fallback；
- 文件名可只有番号，也可包含日期与片名；
- Desktop 先 Preview，再由用户明确点击导入；
- 新 Work 可创建相关 Person / Maker / Label / Series / Genre / Tag；
- 已有 Work 只 fill / merge，不静默覆盖已有核心事实；
- 导入 Work 后再次运行媒体扫描，即可按番号重新绑定既有 MediaFile；
- Shared Pack 继续只读；Rust Writer 只能写当前 Desktop Settings 指定的 Private Library；
- Canonical 删除仍关闭，只有 Private `media-files` 可以删除。

覆盖仓库根目录后执行：

```bash
pnpm install
pnpm check
pnpm desktop:doctor
pnpm desktop:rust:check
pnpm desktop:dev
```

详细设计与人工验收见 `V1_16_MANIFEST.md`、`docs/import/nfo.md`、`docs/decisions/ADR-031-independent-nfo-metadata-roots.md` 与 `docs/development/v1-16-independent-nfo-library-ingest-walkthrough.md`。
