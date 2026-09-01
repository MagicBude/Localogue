# 教材：Demo Library 与私人可写 Library

## 1. 为什么默认不能直接 Commit

默认页面读取：

```text
data/demo-library
```

这是 Git 中的公开虚构教学数据。

如果 Review 页面可以直接修改它，执行一次测试就会让：

```bash
git status
```

出现大量 Demo 数据改动。

因此 V1-06 把默认模式定义为：

> **Demo = 可读、可筛选、可审核，但不可 Canonical Commit。**

## 2. 初始化私人资料库

为了安全学习已有作品更新，可以执行：

```bash
pnpm library:init
```

它会把尚不存在的 Demo Canonical JSON 复制到：

```text
data/library
```

不会覆盖其中已有的 Evidence。

## 3. 启用私人模式

创建：

```text
.env.local
```

内容：

```text
LOCALOGUE_LIBRARY_PATH=./data/library
```

然后重新启动：

```bash
pnpm dev
```

此后：

- 页面读取私人 Library；
- Review 也对私人 Library 分析；
- Commit 写入同一个私人 Library；
- `data/library` 被 Git 忽略。

## 4. validate:data 与 .env.local

V1-06 起，独立校验脚本也会读取 `.env.local`。

因此开启私人模式后：

```bash
pnpm validate:data
```

校验的是私人 Canonical Library，而不是 Demo Library。
