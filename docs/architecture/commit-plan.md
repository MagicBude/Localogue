# Commit Plan 架构

## 1. 数据流

```text
Evidence
   ↓
Review Analysis
   ↓
Review Decisions
   ↓
Commit Plan        ← 仍然只读
   ↓
Explicit Confirm
   ↓
Rebuild Plan
   ↓
Fingerprint Check
   ↓
Canonical Commit
   ↓
Commit Receipt
```

## 2. 为什么还要多一个 Commit Plan

Review Analysis 回答：

> 当前数据有什么差异？

Review Decisions 回答：

> 用户想怎么处理？

Commit Plan 回答：

> 如果现在执行，Localogue **具体会修改什么文件和实体？**

三个概念不可混用。

## 3. Commit Plan 内容

计划包含：

- 目标 Work；
- create / update 模式；
- 准备新建的人物、Maker、Label、Series、Genre、Tag；
- 准备创建或修改的 Work；
- blockers；
- warnings；
- fingerprint。

## 4. Plan 不拥有写权限

`buildCanonicalCommitPlan()` 是纯计划阶段。

它可以构造待写入实体，但不能调用 Repository 的 `save*()`。

真正写入只能通过 `commit-executor.ts`。

这是一条重要架构边界。
