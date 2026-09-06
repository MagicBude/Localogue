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
- `localSourcePath`（可选，仅当前设备用于定位导入前的原图）
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

## 本机来源路径与可移植性

Desktop 从资料目录导入图片时，可以在 `localSourcePath` 保存原图的绝对路径，供界面的“定位原图”使用。该路径只是一条本机便利信息：图片能否继续显示，仍由 `storagePath` 指向的内容寻址管理副本决定。

绝对路径可能包含用户名和私人目录结构，而且换电脑后通常失效。因此 Personal Pack 导出会移除 `localSourcePath`；Shared Pack 也不得依赖或发布此字段。
