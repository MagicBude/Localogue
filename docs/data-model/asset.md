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
