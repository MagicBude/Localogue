# V1-17 Desktop Interaction Parity 实现导读

V1-17 的目标不是把 Next.js 页面复制到 Tauri，而是让 Desktop 在同一 Domain / Repository 语义上完成日常管理闭环。

## 1. 三层职责

```text
React Desktop UI
    ↓
TauriLibraryRepository / Application Query Core
    ↓
Rust Commands（Private-only Writer / Audit Writer / File Runtime）
```

React 不拿任意文件写权限；Shared Pack 路径也不会传给 Writer。

## 2. CRUD

`desktop-management.tsx` 提供：

- `CreateWorkPanel`
- `WorkEditor`
- `CreatePersonPanel`
- `PersonEditor`
- `MediaBindingPanel`

Work 编辑器同时维护人物、Maker、Label、Series、Genre、Tag 关系。Shared Entity 保存时写同 ID Private Override。

## 3. 删除为什么不做简单 rm

Rust `delete_library_entity` 只接受明确集合，并调用引用检查：

- Person 被 Private Work 引用时拒绝删除；
- Work 仍绑定 MediaFile / Asset 时拒绝删除；
- Asset 仍被 Work / Person 引用时拒绝删除。

这比在 React 弹一个确认框更重要，因为真正的安全边界必须位于 Native 层。

## 4. Media 手工绑定

自动扫描仍只做保守 code 匹配。无法识别或识别错误时，用户在 Media 页选择“管理绑定”：

- 搜索 Work；
- bind；
- rebind；
- unbind。

人工结果标记 `matchMethod=manual`，增量扫描必须尊重它。

绑定操作会额外写 `media-binding-receipts`。如果 Receipt 保存失败，Desktop 会补偿恢复原 MediaFile，避免“关系已变但审计丢失”。

## 5. Shared Pack 管理

Packs 页直接管理 `sharedPackPaths`：

- Folder Picker 挂载；
- Native manifest 校验；
- 上移 / 下移改变读取优先级；
- 卸载只移除实例配置，不删除 Pack 文件。

## 6. 仍然没有迁移什么

Evidence / Review / Commit Plan / History / Restore / Portable Pack 等较重治理工作台仍依赖 Web 的 Node 基础设施，V1-18 再逐步抽成平台中立 Application Core + Tauri Adapter；V1-17 不把 Node Route Handler 搬进 Webview。
