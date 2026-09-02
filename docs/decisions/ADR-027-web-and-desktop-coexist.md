# ADR-027：Web 与 Tauri Desktop 并存，而不是互相替代

- 状态：Accepted
- 阶段：V1-13

## 决策

保留现有 Next.js Web，同时增加 `apps/desktop` Tauri 应用。两个宿主共享 Domain / Application 规则，通过不同 Platform Adapter 接入系统能力。

## 原因

1. Web 对 NAS、服务器和局域网访问仍有价值；
2. Desktop 更适合原生目录选择、文件打开、资源管理器、后台任务和 Sidecar；
3. 直接把当前 Server-heavy Next.js 静态化会迫使我们过早重写大量成熟逻辑；
4. 共享业务规则比“选一个 UI 框架赢者通吃”更重要。

## 后果

- 仓库进入最小 pnpm workspace；
- Web 与 Desktop 分别构建；
- 不能在 Desktop UI 复制第二套资料治理逻辑；
- V2 SQLite Repository 未来也必须服务两个宿主。
