# 社区资料的稳定实体 ID

## 为什么共享资料不能用“名字”当主键

Shared Pack 之间要能够叠加，本地资料也要能够覆盖社区资料，因此 Localogue 判断“这是同一个实体”的基础必须是**稳定 ID**，而不是当前显示名称。

例如某位人物可能经历：

```text
正式名 A
  ↓ 改名
正式名 B
  ↓ 中文映射调整
中文名 C
```

如果 ID 由姓名生成，改名就会把同一个 Person 误认为新人物。

同理，作品番号也不应该直接等同于 Work ID：番号属于作品的重要业务标识，但未来仍可能存在修正、多个代码、不同发行版本或同号冲突。

## V1-09 规则

Shared Pack 中的实体 ID 必须：

1. 在发布后保持不变；
2. 不由可变标题、姓名、翻译名直接推导；
3. 在不同用户、不同设备之间保持一致；
4. 不因 Pack 版本更新而重新生成；
5. Merge 后保留明确的旧 ID → 新 ID 映射，而不是静默复用另一个含义。

推荐未来由 Community Data 项目统一生成不可变 ID，例如 UUID / ULID 一类不依赖名称的标识。当前 V1 Domain Model 仍把 ID 定义为字符串，因此具体算法可以在 Community Data 仓库建立前再冻结。

## 为什么稳定 ID 决定 Local Override 能否工作

假设社区 Pack 有：

```text
person_123
头像：A
简介：社区版本
```

用户本地想使用自己的资料：

```text
person_123
头像：B
简介：我的修正
```

因为两层使用同一个 `person_123`，Repository 才能实现：

```text
Private Library
    > Shared Pack
```

如果两个来源分别把同一人物叫成 `person_kana` 和 `person_momonogi`，系统只能把它们视为两个实体，必须经过 Entity Resolution / Merge 才能建立统一身份。

## V1 的 Whole-Entity Override

V1-09 使用的是**整实体覆盖**：本地存在同 ID JSON 时，本地完整实体胜出。

优点是简单、确定、容易教学和迁移；缺点是当社区 Pack 后来补充了某个字段，本地已经覆盖的实体不会自动继承那个字段。

未来可以演进到：

```text
Shared Canonical Base
        +
Local Field Override
        +
Presentation Preference
```

但在字段级合并、Provenance 和冲突规则没有完整设计前，V1 不做隐式 deep merge。

## Community Data 发布前的 ID 建议

在真正开始积累大规模真实社区资料前，应先完成：

- Community ID 生成规则；
- 实体 Merge / Redirect 规则；
- ID Alias / Redirect 文件格式；
- Pack 间依赖规则；
- Provenance 与许可证字段。

因此现阶段可以继续整理私人真实资料，但**不要急着把大量真实数据当成永久 Community Pack 发布**。先让身份体系稳定，再公开长期维护的数据集。
