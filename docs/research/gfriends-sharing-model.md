# Gfriends 共享头像仓库对 Localogue 的启发

参考项目：<https://github.com/gfriends/gfriends>

## 值得学习的点

Gfriends 把“公共头像仓库”作为可复用数据源，其他工具可以直接消费，不需要每位用户自己重新搜集全部头像。

它还有两个与 Localogue 很相关的实践：

1. 人工存储内容拥有更高优先级；
2. 配套导入工具支持本地头像目录，本地头像可以优先于远程仓库来源。

这说明“公共基础数据 + 本地优先覆盖”是一个实际可用的媒体资料管理模式。

## Localogue 不直接照搬的地方

Localogue 管理的不只是头像，还包括：

- Person；
- Work；
- Organization；
- Series；
- Genre；
- Asset；
- MediaFile；
- Provenance。

因此不能只按“文件名优先级”解决所有问题，需要稳定实体 ID 和结构化资料层。

## 图片许可提醒

Gfriends README 也明确说明其头像图片版权归相应网站及演员所属经纪公司。

因此 Localogue 不应把“图片在公开网页能访问”理解成“图片可以自由重新打包发布”。

更适合 Localogue 的方式是：

- 结构化公共元数据单独 Community Pack；
- 可合法再分发图片才进入 Asset Pack；
- 其他图片使用外部 Asset Source / URL；
- 用户始终可以在本地设置自己喜欢的头像。

## Localogue 的进一步抽象

```text
Community Data
       ↓
Shared Pack（只读）
       ↓
Private Canonical Override
       ↓
Local Presentation Preference
```

其中最后一层专门解决“我更喜欢另一张头像/封面”，避免把个人视觉偏好和公共事实数据混在一起。
