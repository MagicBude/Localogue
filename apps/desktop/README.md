# Localogue Desktop

V1-13 的 Tauri 2 Desktop Alpha。

它不是 Localogue Web 的替代品，也不是第二套业务实现。当前职责是验证 Desktop Runtime：

- 原生目录 / 文件选择；
- 默认程序打开与资源管理器定位；
- Tauri App Config / App Local Data；
- Rust `ffprobe` Command；
- Tauri Event Progress；
- Dev / Release identifier 隔离。

## 开发

在仓库根目录：

```bash
pnpm install
pnpm desktop:doctor
pnpm desktop:dev
```

只检查 Desktop Webview：

```bash
pnpm desktop:check
```

构建 Tauri executable：

```bash
pnpm desktop:build
```

V1-13 `bundle.active=false`，因此先验证可执行程序，不在这一版处理安装器、签名和自动更新。

完整前置要求见：

- `docs/desktop/tauri-prerequisites.md`
- `docs/architecture/desktop-runtime.md`
