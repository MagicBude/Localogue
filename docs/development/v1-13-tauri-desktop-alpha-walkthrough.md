# V1-13 教材：第一次把 Localogue 接到 Tauri

## 1. 为什么不直接把 Next.js 页面塞进 Tauri

现有 Localogue 大量依赖 Next.js Server Component、Route Handler、Node 文件系统和服务端 Repository。Tauri 的静态 Webview 并不会自动变成 Next.js Server。

所以 V1-13 不做“大搬家”，而是先验证 Desktop Runtime 的边界。

## 2. Workspace

仓库现在是：

```text
Localogue/
├── package.json            # Next.js Web
├── src/
├── apps/
│   └── desktop/            # Vite + Tauri
└── pnpm-workspace.yaml
```

这不是为了追求 Monorepo 复杂度，而是因为 Web 与 Desktop 已经确实是两个构建目标。

## 3. 一次 Native Folder Picker 发生了什么

```text
React Button
  ↓
TauriFileDialogAdapter
  ↓
desktopBridge.invoke("pick_directory")
  ↓
Rust Command
  ↓
tauri-plugin-dialog
  ↓
OS Native Dialog
```

UI 不知道 Windows Explorer、macOS Finder 或 Linux Portal 的差异。

## 4. ffprobe 为什么放 Rust Command

如果直接给 Webview 通用 Shell 权限，那么任何前端注入漏洞都可能放大成任意进程执行。

因此我们把能力缩成：

```text
probe_media(file, ffprobeExecutable)
```

Rust 端还会检查 executable basename。

这是 Capability Security 的思路：不要问“前端能不能运行命令”，而要问“前端真正需要哪一个最小业务能力”。

## 5. 为什么需要 Event

真正的目录扫描会持续很久。Desktop 不应该把所有任务都设计成一个等待返回的 IPC。

V1-13 用单文件 Probe 先证明：

```text
Rust Task
  ↓ emit
Tauri Event
  ↓ listen
React Progress
```

V1-14 才把完整 ScanCoordinator 接过去。

## 6. Dev / Release identifier

开发版使用额外 config overlay。Tauri CLI 会通过 JSON Merge Patch 合并配置。不同 identifier 会产生不同 App Config / AppData 路径。

这是比“在文件夹名字后面手工加 -dev”更可靠的桌面 Flavor 机制。

## 7. 为什么 V1-13 还不带 ffprobe Sidecar

Tauri externalBin 要求针对每个 target triple 准备对应文件，例如 Windows x64、macOS arm64、Linux x64 的文件名和二进制都不同。

如果我们现在只在配置里写 `externalBin` 却不提供完整目标文件，Desktop Build 会天然坏掉。

所以 V1-13 先支持系统 PATH 或用户指定的 ffprobe。V1-14 再正式建立：

- 获取来源；
- 版本锁定；
- Hash；
- 许可说明；
- target-triple 命名；
- Release 更新。

## 8. 下一步

V1-14 的关键不是“多几个按钮”，而是让完整 MediaScanService 通过 Tauri FileSystem / Hash / Probe Adapter 运行，并用 Event 把 Job 状态送回 Webview。

### 为什么 Dev Overlay 不重复声明 windows

`tauri.dev.conf.json` 只覆盖 `productName` 与 `identifier`。Tauri 的额外配置按 JSON Merge Patch 语义合并，数组字段会整体替换；如果开发配置只为了改窗口标题却重新声明 `app.windows`，反而可能丢失主配置中的窗口尺寸、最小尺寸等属性。V1-13 因此保持窗口定义只有一个来源。


### V1-13 Desktop Open 边界

- `open_web_url` 使用 URL Parser 校验，当前只允许 `http://localhost` 与 `http://127.0.0.1`，不能只依赖字符串前缀。
- `open_path` 当前只允许 Localogue 支持的视频扩展名，避免 Webview 将“默认程序打开”能力扩大成打开 `.exe` / 脚本等任意可执行目标。
- `reveal_in_folder` 只负责在系统文件管理器中定位已经存在的路径，不执行目标。
- 通用 Shell execute/spawn 仍不向 Webview 暴露。
