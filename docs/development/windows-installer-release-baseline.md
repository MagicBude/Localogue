# Windows 安装包发布基线

Localogue Desktop 使用 Tauri 的 NSIS Bundle 生成 Windows 安装程序。普通用户不需要安装 Node.js、pnpm 或 Rust；这些工具只属于开发与打包环境。

## 两条命令的职责

```powershell
pnpm desktop:release:check
pnpm desktop:build
```

第一条命令只做快速静态预检：检查根 package、Desktop package、Tauri 和 Cargo 版本一致，Bundle 已开启，图标与内置示例资源存在，并防止未审核的 ffprobe Sidecar 混入安装包。

第二条命令会先自动执行同一预检，再编译 WebView、Rust 程序和 NSIS 安装器。成功产物位于：

```text
apps/desktop/src-tauri/target/release/bundle/nsis/
```

不熟悉终端时，可以直接双击仓库根目录的两个脚本：

- `build-desktop-exe.bat`：只生成可直接运行的裸 EXE，速度相对快；
- `build-desktop-installer.bat`：生成 EXE 和可分发的 NSIS 安装程序。

脚本内部先切换到自身所在的仓库根目录，再运行环境检查和发布预检。窗口在成功后会暂停，因此从资源管理器双击时也能看见产物位置。失败时脚本返回非零退出码，方便以后接入 CI，而不是无论成功失败都显示“完成”。

## 为什么采用 current-user 安装

`currentUser` 将应用安装到当前用户可写的位置，一般不弹管理员授权。这更符合个人本地资料管理工具的首次使用体验，也避免为了安装程序授予整机级权限。

安装器包含简体中文、英语和日语资源，按 Windows 系统语言选择。应用内 UI 语言仍由 Localogue 自己的设置管理，两者是不同层次。

## ffprobe 边界

当前安装器不捆绑 ffprobe。应用会依次尝试用户设置的 `ffprobe.exe`、应用资源目录和系统 PATH；没有 ffprobe 时仍可建立 MediaFile 索引，只是无法读取时长、分辨率和编码等技术参数。

要把 ffprobe 正式装入发行包，必须先确定每个 target triple 的二进制来源、FFmpeg 许可证文本、版本升级策略和 SHA-256 校验。发布预检目前主动拒绝 `externalBin`，防止仓库只有配置、实际安装包却缺少文件。

## 从“可安装”到“公开发布”还缺什么

本节点提供可在本机或小范围测试的未签名安装包。公开分发前仍需完成：

1. Windows 代码签名证书与 CI 密钥管理；
2. 在干净 Windows 用户账户执行安装、首次启动、升级和卸载验收；
3. 决定更新渠道并签名更新清单；
4. 形成正式版本号、Release Notes、安装包 SHA-256 与回滚流程；
5. 完成 ffprobe 再分发决策，或在首次设置中更清楚地引导用户安装。

安装器能够生成并不等于已经适合公开发布。签名和干净环境验收会直接影响 Windows SmartScreen 提示与升级可靠性，不能用开发机上“能启动”替代。

## Release 图片为什么需要 `blob:` CSP

`DesktopAssetImage` 不把磁盘绝对路径交给 WebView。Native Command 校验 Asset 归属和 `asset-files/` 边界后返回图片字节，React 再用 `Blob` 与 `URL.createObjectURL()` 创建临时地址。这类地址以 `blob:` 开头。

Release WebView 会严格执行 `tauri.conf.json` 的 Content Security Policy。如果 `img-src` 只有 `'self' data:`，Native 读取虽然成功，浏览器仍会拦截最终图片，表现为所有封面破图。配置因此只在 `img-src` 增加 `blob:`；脚本、连接和通用本地路径权限没有随之放宽。Desktop Boundary Validator 会防止这个 Release 专属问题再次出现。
