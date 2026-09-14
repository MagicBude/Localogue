# 开始开发

Localogue 当前进入 **0.2 Desktop Beta Readiness**。Desktop 是正式用户入口；Next.js Web 暂时保留为历史能力宿主与开发验证入口。

## 环境

- Node.js 22+；
- pnpm 11.x；
- Desktop 开发需要 Rust、Cargo、Windows WebView2 与 Tauri 前置依赖。

## 第一次运行 Desktop

```bash
pnpm install
pnpm desktop:doctor
pnpm desktop:dev
```

需要仅运行历史 Web 入口时：

```bash
pnpm dev
```

浏览器打开 `http://localhost:3000`。Web 不再是普通用户的首选上手路径。

## 提交前检查

```bash
pnpm check
```

该命令会执行数据、审计、词表、Provider Coverage、Registry、Catalog、Platform、Desktop、ESLint、TypeScript 和生产构建检查。修改 Rust / Tauri Native Boundary 时还要运行：

```bash
pnpm desktop:rust:check
pnpm desktop:rust:test
```

检查通过不等于实机验收。扫描、取消、播放、安装和任何写入/删除/恢复流程仍需按 [Desktop 全流程审核台账](desktop-ux-audit.md) 使用隔离资料库验证。

## 当前代码阅读顺序

1. [产品定位](../product/positioning.md)
2. [0.2 产品范围](../product/scope.md)
3. [学习路线](learning-path.md)
4. `src/domain`
5. `src/application`
6. `src/infrastructure`
7. `apps/desktop`
8. `src/app`（历史 Web 宿主）

## 当前边界

- 不在 React 组件中直接读写文件或复制业务规则；
- 不让 Importer / Connector 直接覆盖 Canonical；
- 不开放通用 Shell、任意路径或任意进程执行；
- 不自动搬移、重命名或删除用户媒体；
- 不在没有 ADR、许可证和发行方案时打包在线 Provider 或第三方二进制；
- 不把内嵌播放器、转码、云盘下载、通用视频模式或复杂微服务塞进 0.2；
- 不为减少代码量绕过 Domain / Application / Repository 边界。

元数据采集 Adapter 和 Web 退役目前分别由 ADR-048、ADR-047 记录为提议，提议不等于已经决定或实现。
