# 开始开发

Localogue 已进入 V1 File-backed Library。

## 环境

推荐：

- Node.js 22+；
- pnpm 11.x。

## 第一次运行

```bash
pnpm install
pnpm dev
```

打开：

```text
http://localhost:3000
```

## 提交前检查

```bash
pnpm check
```

它会依次执行 lint、TypeScript 类型检查和 Next.js production build。

## 当前代码阅读顺序

先阅读 [学习路线](learning-path.md)，再从 `src/domain` 往 `src/app` 阅读。

## V1 仍然禁止提前加入

- SQLite / ORM；
- 在线爬虫；
- 外部 Provider；
- AI；
- 播放器 / 转码；
- 没有真实需求支撑的 Monorepo 拆包。
