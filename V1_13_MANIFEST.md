# Localogue V1-13 Manifest

## 版本

- Localogue: `0.1.13`
- 阶段：Tauri Desktop Alpha
- 前置版本：V1-12 Platform Abstraction + Incremental Scan
- 新增 JS Workspace：`apps/desktop`
- Desktop：React 19 + Vite 8 + Tauri 2

## 核心目标

V1-13 不追求 Web / Desktop 全功能对等，而是证明 Platform Abstraction 可以落到真实桌面 Runtime，并从第一版固定安全边界和开发/正式数据隔离。

## 新增 Desktop Workspace

- `pnpm-workspace.yaml`
- `apps/desktop/package.json`
- React/Vite Webview
- `src-tauri` Rust Project
- Tauri Config / Dev Config Overlay
- Capability + Application Permission

## 原生能力

- Native Folder Picker
- Native Media File Picker
- Open supported media path with default app
- Reveal in Explorer/Finder
- Open localhost Localogue Web
- Desktop Runtime Info
- Desktop Settings AppConfig Store
- Rust ffprobe Media Probe
- Tauri Task Progress Event

## Platform Adapter

首批：

- TauriFileDialogAdapter
- TauriFileOpenerAdapter
- TauriMediaProbeAdapter

V1-14：

- TauriFileSystemAdapter
- TauriFileHashAdapter
- 完整 MediaScanCoordinator / Event bridge

## 安全

- 主 Webview 使用显式 CSP；
- 自定义 Command 使用 `desktop-runtime` Permission；
- Capability 只挂到 main window；
- 不开放 `shell execute/spawn`；
- ffprobe executable basename 白名单；
- 参数数组固定，不经过 Shell；
- open_web_url 只允许 localhost / 127.0.0.1。

## Dev / Release 隔离

Release：`com.localogue.desktop`

Dev：`com.localogue.desktop.dev`

Tauri App Config / App Local Data 因 identifier 不同而分离。

## ffprobe Sidecar 决策

V1-13 不启用 `externalBin`。先使用 PATH 或用户指定 ffprobe，避免没有完整 target-triple 二进制时默认构建失败。V1-14 建立 Binary Dependency / License / Hash / Release 流程后再打包 Sidecar。

## 新命令

```bash
pnpm desktop:doctor
pnpm desktop:rust:check
pnpm desktop:dev
pnpm desktop:dev:release-data
pnpm desktop:typecheck
pnpm desktop:build:webview
pnpm desktop:check
pnpm desktop:build
pnpm validate:desktop
```

根 `pnpm check` 已加入：

- validate:desktop
- Desktop Webview typecheck
- Desktop Vite build

Rust 编译仍需要用户本机安装 Tauri prerequisites 后通过 `pnpm desktop:rust:check` / `pnpm desktop:dev` / `pnpm desktop:build` 验证。首次 Cargo 检查会生成应提交的 `apps/desktop/src-tauri/Cargo.lock`。

## 文档

- `docs/desktop/tauri-prerequisites.md`
- `docs/architecture/desktop-runtime.md`
- `docs/development/v1-13-tauri-desktop-alpha-walkthrough.md`
- ADR-027
- ADR-028

## 下一阶段

V1-14：Desktop Runtime Integration。


### V1-13 Desktop Open 边界

- `open_web_url` 使用 URL Parser 校验，当前只允许 `http://localhost` 与 `http://127.0.0.1`，不能只依赖字符串前缀。
- `open_path` 当前只允许 Localogue 支持的视频扩展名，避免 Webview 将“默认程序打开”能力扩大成打开 `.exe` / 脚本等任意可执行目标。
- `reveal_in_folder` 只负责在系统文件管理器中定位已经存在的路径，不执行目标。
- 通用 Shell execute/spawn 仍不向 Webview 暴露。
## V1-13 本地验收修正

- 修复 `apps/desktop/tsconfig.node.json` 在 TypeScript 5.9 下 `allowImportingTsExtensions` 与 emit 模式冲突导致的 TS5096。
- Vite Node Config 现在显式 `noEmit: true`；`tsc -b` 只负责类型检查，`vite build` 负责 Webview 构建。
- Desktop workspace 显式声明 `@types/node`，保证 `vite.config.mts` 的 Node Runtime 类型属于 Desktop 自身依赖。


- 修复 Vite 8 Desktop Webview 生产构建仍显式使用已弃用 esbuild Minifier 的问题。
- 正式构建改用 Vite 8 默认推荐的 Oxc Minifier，不额外引入 esbuild 兼容依赖。

## 构建兼容性补充

- `apps/desktop` 显式声明 `esbuild ^0.28.0`，满足 Vite 8.2.x 对自定义 `build.target` 兼容转换的 optional peer dependency。
- `build.minify` 继续使用 `oxc`；保持 Tauri 推荐的 Windows `chrome105` / WebKit `safari14.1` 兼容目标。

## Desktop Webview Target 修正

- `vite build` 独立运行时不会收到 Tauri CLI 的 `TAURI_ENV_PLATFORM`；V1-13 增加 `process.platform` fallback，确保 Windows 上的 `pnpm check` 使用 `chrome105` 而不是误用 WebKit Target。
- Windows WebView2 Target：`chrome105`。
- macOS / Linux WebKit JavaScript Target：`safari14.1`。
- 不再使用旧 Tauri 文档（其 Vite 示例标注为 Vite 5.4.8）中的 `safari13` 作为 Localogue Vite 8 Alpha 基线。
- 固定 `esbuild@0.28.2`，生产压缩仍由 Oxc 负责。
- `validate:desktop` 会检查 Tauri Platform + Host Platform 双路径及 Target 基线。


## V1-13 覆盖升级配置确定性修复

- Desktop Vite 正式配置由 `vite.config.ts` 迁移到 `vite.config.mts`。
- `pnpm dev` 与 `pnpm build:webview` 均显式传入 `--config vite.config.mts`，不再依赖 Vite 自动发现配置文件。
- 新增 `pnpm desktop:clean:legacy`，在根 `pnpm check` 第一阶段清理 V1-13 早期 TypeScript 误生成的 `vite.config.js`、`vite.config.d.ts`、Source Map 与 `*.tsbuildinfo`。
- 清理脚本同时删除被 `.mts` 替代的旧 `vite.config.ts`，确保 ZIP 覆盖升级不会留下两份互相竞争的 Vite 配置。
- `validate:desktop` 新增确定性配置检查：正式 `.mts` 必须存在，Desktop scripts 必须显式指定该配置，根 `pnpm check` 必须先执行 legacy cleanup。
- `.gitignore` 明确忽略历史 Vite emit 产物，避免误提交后再次干扰 Desktop 构建。

- 修复 Windows Desktop Doctor 对 pnpm/Corepack `.cmd` shim 的误判；当 Doctor 本身由 pnpm 启动时直接从当前进程确认 pnpm 版本，避免产生自相矛盾的前置环境错误。

## Desktop build resource follow-up
- Added `apps/desktop/src-tauri/icons/32x32.png`
- Added `apps/desktop/src-tauri/icons/128x128.png`
- Added `apps/desktop/src-tauri/icons/128x128@2x.png`
- Added `apps/desktop/src-tauri/icons/icon.ico`
- Added `apps/desktop/src-tauri/icons/icon.icns`
- Tauri bundle configuration now declares the icon set explicitly.
- Desktop boundary validation requires the icon resources and bundle declaration.

## Desktop Dev Watcher 修正

- `apps/desktop/vite.config.mts` 的 Dev Server 明确设置 `server.watch.ignored = ["**/src-tauri/**"]`。
- Rust 源码与 Cargo `target/` 由 Tauri/Cargo 自己监听，Vite 只负责 Desktop Webview 源码 HMR。
- 避免 Windows/MSVC 构建期间 `.pdb` / `.dll` 被链接器短暂锁定时，Node/Vite `fs.watch` 对同一文件触发 `EBUSY`。
- `validate:desktop` 增加 watcher ignore 回归校验，后续不得重新让 Vite 监听 `src-tauri`。
