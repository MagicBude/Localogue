# Asset 与 Presentation Preference 解析

## 1. 为什么“头像”不能只是 Person 的一个图片路径

Localogue 同时存在三类诉求：

1. Community Pack 提供一个大家都能用的默认头像；
2. 用户可能自己上传更喜欢的头像；
3. 用户选择头像只代表“我喜欢怎样显示”，不一定代表社区事实数据有错误。

如果每次选择头像都复制并修改整个 `Person`，Shared Pack 的后续更新就会被本地整实体覆盖。因此 V1-10 把事实和显示偏好拆开。

## 2. 三层概念

```text
Canonical Person / Work
        │
        ├── 默认 Asset 引用
        │
Private Asset
        │
        └── subjectType / subjectId
        │
Presentation Preference
        │
        └── preferredPortrait / preferredCover
```

最终显示优先级：

```text
Presentation Preference
        ↓ 没有或失效
Canonical 默认 Asset
        ↓ 没有
Placeholder
```

## 3. 本地 Asset 不要求复制 Community Entity

V1-10 给 Asset 增加：

- `subjectType: person | work`
- `subjectId`

所以用户可以给 Shared Person 上传一个本地 Portrait，而不用生成一份完整 Local Person Override。

## 4. Asset 内容寻址

上传图片以 SHA-256 作为二进制文件名：

```text
asset-files/<sha256>.png
```

Asset JSON 保存：

- MIME；
- 宽高；
- 文件大小；
- SHA-256；
- 所属实体。

同一张图片重复上传可以复用同一份二进制。

注意：**二进制内容 Hash 不等于 Asset Entity ID**。Asset ID 还包含 subject 与 Asset type，因此同一张图片可以安全地同时属于不同人物/作品，而不会互相覆盖 Asset JSON。

## 5. Shared Pack Asset

Shared Pack 的 Asset JSON 可以使用相对于 Pack `library/` 的 `storagePath`。Localogue 在读取图片时先定位 Asset 元数据来自哪个资料根，再解析对应文件，不能错误地把 Shared Asset 路径拼到 Private Library 上。

## 6. 安全边界

- 上传暂不支持 SVG，避免未经清洗的脚本/外部引用风险；
- 本地 Asset 路径必须保持在所属 Library Root 内，禁止 `..` 路径逃逸；
- 人物只能选择属于自己或 Canonical 已引用的 portrait/gallery；
- 作品只能选择属于自己或 Canonical 已引用的 poster/cover。
