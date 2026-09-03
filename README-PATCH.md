# V1-20 覆盖包说明

覆盖 V1-19 后运行：

```bash
pnpm install
pnpm check
pnpm desktop:rust:check
pnpm desktop:dev
```

重点验收：

1. Desktop 主导航默认比 V1-19 更窄，且可手动折叠 / 展开；重启后保留折叠状态；
2. Works 和 Person Detail 相关作品的 Facet Rail 更宽，Maker / Series / Genre 等长选项可换行显示；
3. Work Detail 的本地图片资产按海报 → 背景图 → 缩略图 → 封面 → 其他顺序显示；
4. 顶部可以独立切换 UI Language 与 Metadata Language；
5. 中文 / 日本語 / English 切换覆盖 Home、Works、People、Browse、Media、Packs、Settings 和日常 CRUD；
6. 元数据语言切换只改变实体展示名称，不修改 Canonical Library；
7. V1-18 Hotfix 3 的 Unified Library / Native I/O 同步链仍正常。

V1-20 不修改 Canonical Schema，也不修改已通过 Windows 实机验证的 Rust 扫描 / Asset Native I/O 核心。Evidence / Review / Curation / History / Portable Pack 完整治理继续进入 V1-21。
