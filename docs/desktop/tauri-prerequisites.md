# Tauri Desktop 开发前置环境

V1-13 开始，Localogue 同时包含 Next.js Web 与 Tauri Desktop。只开发 Web 时不要求安装 Rust；只有运行/编译 Desktop 才需要 Tauri 系统依赖。

## Windows

Tauri 2 官方要求 Windows 开发环境具备：

1. Microsoft C++ Build Tools，并安装 **Desktop development with C++** 工作负载；
2. Microsoft Edge WebView2 Runtime；Windows 10 1803+ 通常已经自带；
3. Rust stable MSVC toolchain；
4. Node.js / pnpm。

Rust 可使用：

```powershell
winget install --id Rustlang.Rustup
rustup default stable-msvc
```

安装完成后重新打开终端，然后在仓库根目录运行：

```bash
pnpm desktop:doctor
```

## 第一次安装依赖

V1-13 新增 `apps/desktop` workspace，因此覆盖 V1-13 后第一次需要：

```bash
pnpm install
```

然后：

```bash
pnpm check
```

`pnpm check` 会检查 Web 与 Desktop Webview 的 TypeScript/Vite，但不会运行 Rust 编译。Rust/Tauri 本机验证使用：

```bash
pnpm desktop:doctor
pnpm desktop:rust:check
pnpm desktop:dev
```

## Dev / Release 数据为什么分开

正式配置使用：

```text
com.localogue.desktop
```

开发配置使用：

```text
com.localogue.desktop.dev
```

Tauri App Config / App Local Data 路径会基于 bundle identifier 解析，因此开发版不会默认复用正式版桌面设置。

如果确实要用正式 identifier 测试，可以执行：

```bash
pnpm desktop:dev:release-data
```

这个命令要谨慎使用。


## Cargo.lock

仓库初始化包不伪造 `Cargo.lock`。第一次在真正的 Rust/Cargo 环境中运行：

```bash
pnpm desktop:rust:check
```

Cargo 会生成 `apps/desktop/src-tauri/Cargo.lock`。Localogue Desktop 是应用程序而不是 Rust Library，因此这个锁文件应该加入 Git；它和 `pnpm-lock.yaml` 一样用于固定可复现依赖。
