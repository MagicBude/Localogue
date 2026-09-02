# Asset：资源

Asset 管理与资料相关的图片和附件。

## 典型类型

- `cover`
- `poster`
- `fanart`
- `screenshot`
- `portrait`
- `gallery`
- `logo`
- `subtitle`
- `other`

## 建议字段

- `id`
- `type`
- `storagePath`
- `sourceUrl`
- `mimeType`
- `fileSize`
- `width`
- `height`
- `sha256`
- `createdAt`
- `sourceEvidenceId`

## 原则

- 数据文件中只存路径和元数据，不把大图 Base64 塞进 JSON；
- 同一作品可以保存多个封面候选；
- 可单独指定 preferred cover / poster；
- 哈希可用于重复检测。

## V1-10 补充：subject 与本地展示资源

V1-10 的本地上传 Asset 可以带：

- `subjectType: person | work`
- `subjectId`

它允许用户给 Shared Person / Work 添加自己的图片，而无需复制整个共享实体。

真正“显示哪一张”由 `PresentationPreference` 决定，Asset 本身只描述资源及其归属。
