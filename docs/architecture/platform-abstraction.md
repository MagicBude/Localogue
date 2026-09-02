# Platform Abstraction：从 Next.js Web 走向 Tauri Desktop

V1-12 开始，Localogue 不再把“文件系统、ffprobe、Hash、目录选择器、打开文件”视为业务逻辑的一部分。

## 为什么现在做

Localogue 目前运行在 Next.js Web Runtime，但产品目标已经明显包含桌面能力：

- 原生选择资料库与媒体目录；
- 扫描大量本地文件；
- 调用 ffprobe；
- 打开默认播放器；
- 在 Explorer / Finder 中定位文件；
- 后台任务、托盘与通知；
- 后续 Tauri Desktop。

如果 Application Service 继续直接 `import node:fs`、`node:path`、`child_process`，未来桌面化就会变成重写业务层。

## V1-12 的 Ports

`src/application/platform/platform-ports.ts` 定义：

- `FileSystemPort`
- `MediaProbePort`
- `FileHashPort`
- `FileDialogPort`
- `FileOpenerPort`
- `PlatformCapabilities`

当前实现位于：

```text
src/infrastructure/platform/
├── node-platform-adapters.ts
└── node-platform-provider.ts
```

Next.js 仍使用 Node Adapter；V1-13 已新增首批 Tauri Adapter。

## 依赖方向

正确：

```text
MediaScanService
      ↓
Platform Ports
      ↑
Node Adapter / Tauri Adapter
```

错误：

```text
MediaScanService
      ↓
node:fs / child_process
```

## V1-12 不是“一次性重写全部平台代码”

已有的 Asset Upload、Portable Pack、Settings 等部分服务仍有 Node 实现债务。V1-12 先选择最典型、最重的平台任务——Media Scan——完成端到端抽象，并加入 `pnpm validate:platform` 防止它重新退化。

后续桌面化时逐步迁移：

1. Media Scan（V1-12 已完成）；
2. Folder / File Dialog（V1-13 Tauri）；
3. Open / Reveal File（V1-13 Tauri）；
4. Pack Import / Export 文件选择；
5. Asset Upload / Storage；
6. Settings AppData；
7. SQLite / Background Worker。

## Web 与 Desktop 并存

长期目标不是“用 Tauri 替换 Web”，而是：

```text
Domain + Application
       │
       ├── Localogue Web / Next.js
       └── Localogue Desktop / Tauri
```

NAS / Server 用户继续使用 Web，桌面用户获得原生能力。
