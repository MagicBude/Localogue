# V1-18 Desktop Presentation Parity 与 Unified Library 同步实现导读

## 为什么 V1-17 有 Asset 能力，作品页仍然没有图片

V1-17 解决的是“发现、导入、关联”本地图片，但 Desktop Work Tile 本身仍只渲染占位符，而且图片二进制没有安全的 WebView 读取通道。另一方面，Media Scan 与 NFO / Asset Import 是独立动作，因此只运行视频扫描时会得到 `182 个视频 · 0 个 Asset` 这样的合法但不完整状态。

V1-18 同时补两条缺口：Presentation 与同步编排。

## 1. 安全读取 Private Asset

Rust 新增 `read_private_asset_bytes`。它不会接受任意绝对路径，而是以 Desktop Settings 中的 Private Library 为唯一根目录，只读取 `asset-files/` 下经过限制的图片，并 canonicalize 根与目标以阻止符号链接越界。

React `DesktopAssetImage` 把返回的 bytes 转成 Blob URL，并在组件卸载时 revoke。这样海报可以显示，但 WebView 没有获得整个资料盘的读取权限。

## 2. Works 三种展示方式

`desktop-work-results.tsx` 提供：

- `grid`：海报墙；
- `list`：缩略图 + 核心字段；
- `table`：高密度字段表格。

视图模式保存在 Desktop localStorage，但三种视图共享同一批 `Work` 查询结果。切换视图不会改变过滤、排序或分页的业务语义。

Work 的 poster 解析同时检查：

1. `Work.assetIds`；
2. `Asset.subjectType=work && subjectId=work.id`。

优先 `poster`，其次 `cover`。

## 3. Unified Library 一键同步

Media 页面新增“同步资料库”。执行顺序固定为：

1. 扫描 Unified Root / NFO 路径；
2. 导入可识别 NFO，先创建或 fill/merge Work；
3. 重新扫描本地图片，使刚创建的 Work 也能成为 Asset 关联目标；
4. 导入可关联 poster / cover / fanart / thumb；
5. 刷新 Repository；
6. 运行既有增量媒体扫描，使 MediaFile 使用最新 Work 集合重新匹配。

媒体 size + mtime 未变化时仍走 V1-14 fast path，不会因为同步 NFO / Asset 就无条件重复 ffprobe 和视频 SHA-256。

## 4. 为什么仍保留分开的按钮

“一键同步”适合正常使用；分开的 Preview / Import 仍然有价值：

- 调试特殊 NFO；
- 只检查图片候选；
- 只重新扫描视频；
- 在真正写入 Canonical 前人工核对。

因此 V1-18 是增加编排层，不是删除已有可控步骤。

## 5. 本机验收

```bash
pnpm check
pnpm desktop:doctor
pnpm desktop:rust:check
pnpm desktop:dev
```

真实资料库建议验证：

1. Settings 添加共同父目录到 Unified Library Root；
2. Media 点击“同步资料库”；
3. `Asset` 计数应从 0 增长；
4. Works 切换海报墙 / 列表 / 表格，结果数保持一致；
5. 海报墙和列表能显示 Private poster；
6. Work Detail 能显示首图和 Asset 预览；
7. `写真/` 等分类目录中的视频仍正常作为 Media 扫描。
