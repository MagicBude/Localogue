# ADR-020：Shared Base 只读，本地稳定 ID 覆盖优先

## 状态

Accepted · V1-09

## 决策

Community / Shared Pack 作为只读基础资料层。

读取优先级：

```text
Private Library > Shared Packs（顺序优先）
```

相同稳定 ID 采用前一个数据源的完整实体。

## 原因

- 公共资料不需要每位用户重复搜集；
- 用户修正必须优先；
- Shared Pack 更新不能直接改写私人文件；
- 稳定 ID 是跨 Pack 和本地 Override 的连接点。

## 后续

Asset 阶段增加独立 Presentation Preference，使“我喜欢的头像/封面”不必通过覆盖整个人物事实实体来实现。
