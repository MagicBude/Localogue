# Desktop 本地诊断日志

## 为什么默认启用

扫描失败可能来自目录权限、网络盘暂时离线、ffprobe 不可用、文件达到安全上限或资料命名无法匹配。只在界面显示一条短消息，关闭应用后就失去了排查依据。

Desktop 因此把各页面最终呈现的状态消息汇合到 `App`，再通过受限 Native Command 追加到本地日志。页面组件仍只调用 `setMessage`，不直接知道日志文件位置，也不各自实现文件写入。

## 安全边界

- WebView 只能传 `info / warn / error` 和最多 8,000 字符的消息；
- 日志路径固定为 App Local Data 下的 `logs/localogue.log`；
- WebView 不能指定其它写入位置；
- 写入前替换用户主目录、Private Library、内容根目录、兼容扫描目录、Shared Pack 路径和 ffprobe 路径；
- 单文件达到 1 MiB 后轮转，最多保留 `localogue.log.1` 至 `.3`；
- 日志写入失败不会阻断用户正在执行的资料操作。
- 实际追加操作在 Tauri blocking worker 中执行，不占用主线程处理窗口交互。

设置页提供“打开日志位置”，Native 只在文件管理器中定位日志文件，不执行日志内容。
