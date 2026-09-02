# ADR-025：先建立 Platform Ports，再引入 Tauri Shell

## 状态

Accepted · V1-12

## 决策

Localogue 不在现有 Next.js 业务层上直接堆 Tauri API。

在创建 Desktop Shell 前，先把平台能力表达成 Application Ports，并由 Node/Web Adapter 实现当前行为。

## 原因

如果先创建 Tauri 窗口，再逐个把 `fs/path/child_process` 从业务代码中挖出来，会形成两个运行时各自维护业务逻辑。

Platform Port 让：

```text
Domain / Application
```

保持共享，而：

```text
Web / Tauri
```

只负责环境差异。

## 后果

V1-13 可以创建 Tauri Desktop Alpha，但不会直接复用 Next.js Server Route 作为桌面架构核心。
