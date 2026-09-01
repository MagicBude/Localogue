# ADR-011：V1 优先采用单一 Next.js 应用，而不是 Monorepo

- 状态：接受
- 日期：2026-09-01

## 背景

Localogue 当前只有一个实际运行产品：Web 应用。

过去的项目经验表明，过早拆分多个 workspace/package 会带来：

- 包管理和依赖边界；
- 跨包 TypeScript 配置；
- 构建顺序；
- 发布边界；
- 更多脚本和目录理解成本。

这些成本在 V1 尚没有对应产品收益。

## 决策

V1 使用一个 Next.js 应用，在 `src/` 内采用逻辑分层：

```text
src/
├── domain/
├── application/
├── infrastructure/
├── app/
├── components/
├── i18n/
└── lib/
```

## 为什么不会阻碍未来拆包

Domain Model 和 Repository Interface 已经有明确边界。

未来如果出现真正独立的：

- CLI；
- SDK；
- Schema package；
- Import worker；

可以再把已有边界迁移成 packages，而不是现在为了“看起来专业”提前拆分。

## 结果

短期代码更容易阅读和学习，同时保留未来演进空间。
