# Localogue V1-16 Manifest

## 版本

- Localogue：`0.1.16`
- Desktop Workspace：`0.1.16`
- Rust Crate / Tauri：`0.1.16`

## 主题

**Desktop Feature Parity II — Independent NFO Library Ingest**

V1-16 首先解决真实本地资料库迁移的关键缺口：NFO 不再被假设为“视频旁 sidecar”，而是可以作为独立元数据目录批量扫描、预览和导入 Private Canonical Library。

## 新增

- 实例设置新增 `nfoScanPaths`；
- Web / Desktop 设置均理解独立 NFO 目录；
- Desktop 新增 NFO 扫描预览与显式批量导入；
- XML 番号优先，文件名番号 / 日期 / 片名作为 fallback；
- 支持 `SONE-123`、`ABW001`、`300MIUM-123`、`FC2-PPV-1234567` 等典型番号；
- 同番号多 NFO 去重：优先元数据更完整者，其次较新的文件；
- 新 Work 可创建 Person / Organization / Series / Genre / Tag；
- 已有 Work 采用 fill / merge，不静默覆盖已有核心事实；
- `findWorkByCode` 统一采用 compact code 比较，兼容 `ABW001` / `ABW-001`；
- Rust 新增受限 `read_nfo_text`，仅允许 `.nfo` 且最大 10 MB；
- Desktop Private Canonical 写白名单扩大到 Works / People / Organizations / Series / Genres / Tags / MediaFiles，并增加集合级最小结构校验；
- Shared Packs 继续只读；Rust 写根由当前 Desktop Settings 的 Private Library 决定，Webview 不能指定任意写根；
- Canonical 删除继续关闭，仅 `media-files` 可删除；Asset 仍未开放 Desktop 写入；
- NFO 导入定位为显式确认的 Bootstrap Ingest；冲突型修改与完整 Evidence / Review / History 继续留给 V1-17。

## 典型流程

```text
独立 NFO 目录
  -> Scan / Preview
  -> Explicit Import
  -> Private Work / People / ...
  -> Media incremental scan
  -> code match
  -> MediaFile <-> Work
```

## 本机验收

```bash
pnpm install
pnpm check
pnpm desktop:rust:check
pnpm desktop:dev
```

Desktop 中：

1. Settings 添加 Private Library；
2. 添加媒体扫描目录；
3. 添加一个或多个 NFO 元数据目录；
4. Media -> 扫描 NFO；
5. 检查预览后导入；
6. 再运行媒体扫描，确认已有媒体按番号绑定到刚导入的 Work。
