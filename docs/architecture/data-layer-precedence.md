# 数据分层与优先级

## 目标

Localogue 不应该要求每位用户重新收集一遍已经公开、可合法共享的基础资料；同时也不能让社区资料覆盖用户自己的修正和显示偏好。

V1-09 因此引入三层概念：

```text
Local Presentation Preference（未来 V1-10）
          ↓ 只决定“我想怎么看”
Local Canonical Override
          ↓ 同一稳定 ID 时优先
Shared Pack 1
          ↓
Shared Pack 2
          ↓
...
```

如果没有任何真实数据层，Localogue 才回退到 `data/demo-library`。

## V1-09 已实现的读取优先级

```text
Private Library
    > Shared Pack（设置页面从上到下）
    > Demo（仅无真实数据源时）
```

### 为什么 Demo 不是最后一个通用 fallback

Demo 是教学数据。如果用户已经挂载真实 Shared Pack，却因为某个实体缺失而突然混入虚构人物，会造成非常危险的“假数据污染”。

因此 Demo 只在**没有私人 Library，也没有有效 Shared Pack** 时出现。

## 同 ID 覆盖规则

当前 JSON 阶段采用**整实体覆盖**：

- Shared Pack 有 `person_a`；
- 私人 Library 也有 `person_a`；
- 读取时只使用私人 Library 的 `person_a`。

这是最简单、最容易理解和验证的规则。

### 局限

整实体覆盖意味着社区包更新了 `person_a` 的其他字段后，本地完整副本不会自动“部分继承”新字段。

这不是最终形态。未来 SQLite / Provenance 阶段可进一步演进为字段级来源优先级与 Merge Plan。

## “我的头像”不应该等同于“修改社区事实”

头像、封面等用户显示偏好应进一步分成独立的 Presentation Preference：

```text
Community Person
    portrait = community_asset_A

My Preference
    preferredPortrait = local_asset_B
```

这样社区资料仍能更新人物生日、状态、别名等字段，而用户依然看到自己喜欢的头像。

这一层计划在 Asset 治理阶段实现。
