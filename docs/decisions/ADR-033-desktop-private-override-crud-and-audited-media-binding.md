# ADR-033：Desktop CRUD 写 Private Override，Media 人工绑定必须审计

## 状态

Accepted — V1-17

## 背景

V1-15 以后 Desktop 已能把 Private Library 与多个 Shared Pack 合并读取。V1-17 开始允许用户在 Desktop 直接编辑 Work / Person，如果直接把当前“合并后实体”的来源路径当成写入目标，会出现两个问题：

1. Shared Pack 可能被误写，破坏“社区/共享基础资料只读”的边界；
2. MediaFile 人工绑定是用户明确治理操作，如果只静默修改 `workId`，会丢失 before / after 审计上下文。

## 决策

### Shared Entity 编辑使用 Private Override

Desktop 编辑器不修改 Shared Pack。保存任何 Work / Person 时统一调用 Private Canonical Writer：

- 当前实体本来就在 Private Library：更新 Private JSON；
- 当前实体只来自 Shared Pack：在 Private Library 写入同稳定 ID 的完整实体，形成 Local Override；
- Repository 仍按 `Private > Shared 1 > Shared 2` 合并，因此保存后立即展示 Private 版本。

### 删除只删除 Private Entity

Desktop 删除命令不接受目标根目录，只从 Desktop Settings 解析 Private Library。

V1-17 只开放：

- `works`
- `people`
- `assets`
- `media-files`

Work / Person / Asset 删除前必须检查 Private 引用，避免产生悬空关系。

### Media 人工绑定保存 Receipt

`bind / rebind / unbind`：

1. 先写新的 Private MediaFile；
2. 再通过独立 Native Audit Writer 写 `media-binding-receipts`；
3. Receipt 失败则恢复原 MediaFile。

Audit Writer 不复用 Canonical Writer 的集合参数，V1-17 只允许 `media-binding-receipts`。

## 结果

- Shared Pack 的“只读”由 Rust Boundary 强制，不依赖 UI 自觉；
- 用户可以自然地“修改共享资料”，实际得到的是私人覆盖层；
- MediaFile 手工关系改变具备可追溯 before / after；
- V2 换 SQLite 时仍可保持相同 Repository / Override 语义。
