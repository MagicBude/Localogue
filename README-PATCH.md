# Localogue V1-17 Unified Library Source & Desktop Interaction Parity II 覆盖包

这是从 V1-16 升级到 V1-17 的完整仓库覆盖包。

V1-17 针对真实媒体库中“视频、NFO、海报、Fanart 分散在不同子目录”的组织方式，引入 Unified Library Root；目录名没有特殊语义，`写真/` 中的视频也会按扩展名正常扫描。

同时完成 Desktop 日常交互基线：

- Work / Person Private 新建、编辑、删除；
- Shared Entity 编辑为 Private Override；
- Works / People 搜索、筛选、排序；
- Work ↔ Person / Maker / Label / Series / Genre / Tag 关系编辑；
- Shared Pack 校验、挂载、排序、卸载；
- MediaFile bind / rebind / unbind；
- `media-binding-receipts` 审计与失败补偿；
- NFO Work Group + poster / cover / fanart / thumb 本地 Asset 汇聚。
- Work 详情可显式解除 / 删除 Private Asset 元数据，完成受引用保护的 Work 删除闭环。

覆盖后运行：

```bash
pnpm install
pnpm check
pnpm desktop:doctor
pnpm desktop:rust:check
pnpm desktop:dev
```

V1-18 再继续 Evidence / Review / Curation / History / Portable Pack 与 Native Asset 展示等重治理能力。
