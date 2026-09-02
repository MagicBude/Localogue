# 教材：V1-11 便携 Pack 与 MediaFile 人工绑定

## 一、为什么“目录协议”和“传输容器”应该分开

Shared Pack 的业务结构是：

```text
manifest + library + sources
```

它不应该依赖 ZIP。Git clone、NAS 目录、未来网络下载都可以承载同一结构。

`.localogue-pack` 只是把这些文件装进一个可校验的传输容器。因此 `portable-pack-codec.ts` 位于 Infrastructure，Domain 只认识 PortablePackEnvelope/Manifest。

## 二、Preview 为什么先于 Import

导入属于写操作。V1-11 先执行：

```text
Decode
→ Path Validation
→ Size / SHA-256
→ Kind-specific Rules
→ Conflict Detection
→ Preview
```

用户确认后才 Import。

Personal Pack 默认 skip existing，是典型的“安全默认值”：换电脑空库可直接恢复；已有资料库不会被一个备份包静默覆盖。

## 三、Shared Pack 为什么先临时解包

跨多个文件写入时不能边解边宣布成功。流程是：

```text
Temporary Directory
→ write all files
→ Community Validator
→ rename to final install directory
→ update settings
```

这和 V1 的 Canonical Commit/Snapshot 思路相同：先保证可验证，再把状态切换为“正式可见”。

## 四、MediaFile 绑定为什么也是 Service

React 页面不直接修改 JSON：

```text
MediaBindingWorkbench
→ PUT /api/media/[id]/binding
→ MediaBindingService
→ LibraryRepository
→ MediaBindingReceipt
```

这样以后 V2 换 SQLite 时，页面无需知道 `UPDATE media_files SET work_id=?` 的存在。
