# Localogue V1-14 Manifest

## 版本

- Localogue：`0.1.14`
- 阶段：Desktop Runtime Integration
- 前置版本：V1-13 Tauri Desktop Alpha fixed8

## 核心交付

- `TauriFileSystemAdapter`：目录遍历、stat、exists 与跨平台路径语义；
- `TauriFileHashAdapter`：稳定 MediaFile ID 摘要与 Rust 流式文件 SHA-256；
- `TauriScanRepository`：只读 works、读写私人 media-files；
- Desktop 直接复用 `MediaScanCoordinator` / `scanMediaLibrary`；
- UI 支持扫描启动、阶段进度、取消与 added/updated/unchanged/probed/removed 统计；
- Desktop Settings 补齐 `sharedPackPaths`，与 Web Instance Settings 保持字段语义一致；
- ffprobe 支持显式路径、应用 resources/bin 与 PATH 回退。

## 安全边界

- 不开放通用 shell execute/spawn；
- 原生集合访问只允许 `works` / `media-files`；
- 只有 `media-files` 从 Webview 路径写入；
- 实体 ID 只能包含 ASCII 字母、数字、下划线与连字符；
- 遍历不跟随符号链接，并保留 25000 条相关文件上限；
- ffprobe 始终执行 basename 白名单与固定参数数组。

## 覆盖升级

本包是完整仓库覆盖包。解压到 Localogue 仓库根目录并覆盖同名文件，然后执行：

```bash
pnpm install
pnpm check
pnpm desktop:doctor
pnpm desktop:rust:check
pnpm desktop:dev
```

V1-13 已有 `desktop:clean:legacy` 仍会在 `pnpm check` 首阶段清理旧 Vite 配置残留。

## ffprobe 发行说明

V1-14 完成安全发现与运行时管理，但不在源码包中虚构或内置第三方二进制。正式发布前应为每个 target triple 准备获准再分发的 ffprobe、许可证文本、版本记录与 SHA-256，然后放入发行资源流程。未准备齐时不要声明 Tauri `externalBin`。

## 校验

- `node scripts/validate-desktop-boundaries.mjs`
- `node scripts/validate-platform-boundaries.mjs`
- `pnpm check`（用户本机依赖环境）
- `pnpm desktop:rust:check`（用户本机 Rust/Tauri 环境）

## 首轮本地验收修正

- 修复 `sha256_file` 对 `Sha256` 哈希器状态直接使用 `LowerHex` 导致的 Rust E0277；
- 改为 `digest.finalize()` 后再格式化摘要字节；
- Desktop Boundary Validator 增加对应回归检查。
