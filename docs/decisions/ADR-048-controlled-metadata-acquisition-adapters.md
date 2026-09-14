# ADR-048：在线元数据通过受控 Adapter 形成 Evidence

**状态：提议中。**

## 背景

Localogue 已能扫描、识别、浏览、编辑和委托播放，但在线元数据仍依赖用户预先使用其他工具生成 NFO。这个缺口与“单一 App 完成日常流程”的目标冲突。

直接把各网站解析逻辑移植进 React / TypeScript 会扩大维护面；无约束调用外部程序又会引入进程权限、版本、日志、取消、凭据和跨平台发布问题。任何来源结果直接写 Canonical 也会破坏 Evidence-first 不变量。

## 提议

优先采用**受控子进程 Adapter**：

1. Adapter 使用版本化 JSON Lines 或等价结构化协议；
2. 输入只包含明确任务、番号、允许的 Provider 与运行选项；
3. 输出包含原始来源标识、抓取时间、字段值、资源 URL、警告和错误；
4. Localogue 将结果保存为不可变 Evidence，再走 Normalizer、Entity Resolution、Review 与 Commit Plan；
5. Rust 仅允许启动配置或打包的已知 Adapter，不向 Webview 开放通用 Shell；
6. Job 必须支持进度、超时、取消、重试、限速和脱敏日志；
7. Provider Cookie、Token 与代理配置不得写入 Catalog、Evidence 导出或普通日志；
8. 第三方项目必须完成许可证、版本固定、校验摘要、更新方式和三平台发行审查。

## 暂不选择的方案

- **全部 Port 到 TypeScript**：短期重复实现成熟解析规则，Provider 变化会持续占用主项目维护能力；
- **把任意命令行交给用户填写**：难以保证参数转义、权限、安全提示和可重复诊断；
- **Provider 直接写 Catalog**：绕过来源历史、字段审核与私人覆盖规则。

## 试点建议

先选择一个许可证与稳定性可控的 Adapter，完成“一个番号 → 进度 → Evidence Preview → 人工确认”的端到端试点。试点不下载全量图库，只记录来源 URL 与必要缓存；失败不能影响本地浏览。

## 待决问题

- 首个 Adapter 选择、许可证和再分发方式；
- 是否作为 0.2 Stable 门槛，或进入 0.3；
- 图片缓存、反盗链和来源失效时的最低离线资料策略；
- macOS / Linux 与 Windows 的进程打包差异。

## 当前影响

本 ADR 只确定讨论边界。未被接受前，不接入在线 Provider、不新增通用进程权限，也不把元数据采集写成已实现能力。
