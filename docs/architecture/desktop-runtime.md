# Desktop Runtime 架构

## 目标

Localogue 不从 Web “改造成” Desktop，而是让两个宿主共享业务规则：

```text
                       Domain / Application
                        /              \
              Next.js Web           Tauri Desktop
                 |                        |
          Node Platform Adapter      Tauri Adapter
                 |                        |
           Node / Server              Rust / OS
```

V1-13 先落地最短但真实的一条桌面纵向链路。

## V1-13 已实现

### Webview

`apps/desktop/src` 使用 React + Vite。它只负责桌面 Runtime 控制台，不复制完整 Web 资料页。

### Tauri Bridge

`tauri-bridge.ts` 负责 `invoke` 与 Event subscribe。组件不散落 Tauri 命令字符串。

### 首批 Adapter

- TauriFileDialogAdapter
- TauriFileOpenerAdapter
- TauriMediaProbeAdapter

它们实现 V1-12 已冻结的 Platform Port 形状。

FileSystemPort / FileHashPort 尚未在 V1-13 完整迁入 Desktop，因为完整 MediaScanService 仍运行在 Web/Node Runtime。V1-14 再继续。

## Rust Command 边界

当前暴露：

- get_runtime_info
- load_desktop_settings
- save_desktop_settings
- pick_directory
- pick_media_file
- open_path
- reveal_in_folder
- open_web_url
- probe_media

所有命令都由 `desktop-runtime` 应用 Permission 显式授权。

## 为什么不开放 Shell

媒体工具很容易诱导实现成：

```text
Webview -> shell.execute(userInput)
```

这是错误边界。V1-13 `probe_media` 在 Rust 中使用固定 ffprobe 参数，且 executable basename 必须为 `ffprobe` 或 `ffprobe.exe`。Webview 没有通用进程执行权限。

## Event

Rust 发出：

```text
localogue://desktop-task-progress
```

当前用于 Media Probe：

```text
preparing -> probing -> completed / failed
```

V1-14 会复用这个思路映射完整 MediaScanCoordinator。

## Settings

V1-13 Desktop Settings 是 Bootstrap 设置，位于 Tauri App Config。

它暂时与 Web：

```text
.localogue/settings.json
```

分离。这个差异必须在 UI 中明确，不允许假装已经同步。

未来 Desktop 成为完整宿主后，再设计 Instance Settings 的单一真相源与迁移策略。


### V1-13 Desktop Open 边界

- `open_web_url` 使用 URL Parser 校验，当前只允许 `http://localhost` 与 `http://127.0.0.1`，不能只依赖字符串前缀。
- `open_path` 当前只允许 Localogue 支持的视频扩展名，避免 Webview 将“默认程序打开”能力扩大成打开 `.exe` / 脚本等任意可执行目标。
- `reveal_in_folder` 只负责在系统文件管理器中定位已经存在的路径，不执行目标。
- 通用 Shell execute/spawn 仍不向 Webview 暴露。
