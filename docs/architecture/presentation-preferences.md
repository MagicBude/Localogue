# Presentation Preference：共享事实与“我的展示选择”分离

## 问题

Community Data 可以告诉 Localogue：

- 这个 Person 是谁；
- 有哪些公开姓名和别名；
- 哪些头像 / 图片 Asset 可用；
- 这个 Work 有哪些封面候选。

但“我最喜欢显示哪张头像”不是公共事实，而是**用户偏好**。

如果为了换头像就复制并修改整个 Community Person，会带来两个问题：

1. 用户只是换展示图，却意外冻结了整个人物实体，后续社区资料更新无法自然继承；
2. 私人偏好和事实修正混在一起，Provenance 很难解释。

## 设计方向

从 V1-10 起，Localogue 应把显示偏好独立成 Presentation Preference。

概念上：

```text
Shared Canonical Fact
        +
Private Canonical Override（我确认的事实修正）
        +
Private Presentation Preference（我喜欢怎么显示）
        ↓
最终页面
```

例如：

```json
{
  "entityType": "person",
  "entityId": "person_123",
  "preferredPortraitAssetId": "asset_my_favorite_portrait"
}
```

作品则可以有：

```json
{
  "entityType": "work",
  "entityId": "work_456",
  "preferredCoverAssetId": "asset_my_cover",
  "preferredPosterAssetId": "asset_my_poster"
}
```

## 读取优先级

人物头像预计采用：

```text
Local Presentation Preference
        >
Local Canonical portraitAssetId
        >
Shared Canonical portraitAssetId
        >
Shared / Local Asset 候选中的默认规则
```

因此即使 Community Pack 更新了默认头像，用户已经明确选择的本地头像仍保持不变。

## 与 Local Override 的区别

Local Override 表示：

> 我认为这个 Canonical 实体事实应该这样保存。

Presentation Preference 表示：

> 我不一定否定社区事实，只是我想这样显示。

例如：

- 修正错误出生日期 → Local Canonical Override；
- 选择自己喜欢的头像 → Presentation Preference；
- 给作品选择另一张封面 → Presentation Preference；
- 修改错误番号 → Local Canonical Override。

## 为什么 V1-09 先不实现

V1-09 先把 Shared Pack、Private Library 和设置路径做好，保证数据层优先级稳定。

V1-10 再实现 Asset / MediaFile 时，Presentation Preference 才有真实 Asset ID 可以引用。这样不会先设计一个没有资源实体支撑的空壳偏好系统。
