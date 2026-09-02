# ADR-028：Tauri Webview 只获得最小业务命令，不开放通用 Shell

- 状态：Accepted
- 阶段：V1-13

## 决策

Tauri 主窗口通过应用级 Permission 只获得 Localogue 明确需要的 Command。V1-13 不授权通用 shell execute/spawn。

`ffprobe` 通过专用 Rust `probe_media` Command 调用：

- executable basename 只允许 `ffprobe` / `ffprobe.exe`；
- 参数由程序固定；
- 不使用 shell 字符串拼接。

## 原因

Webview 仍然是 Web 内容。即使本地应用没有公网页面，前端漏洞也不应该自动升级为任意系统命令执行。

## 后果

- 新原生能力优先设计成窄 Command / Port；
- Capability / Permission 是代码评审的一部分；
- `pnpm validate:desktop` 必须防止通用 Shell 权限被误加回来。
