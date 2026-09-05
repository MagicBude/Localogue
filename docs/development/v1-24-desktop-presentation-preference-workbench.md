# V1-24A Desktop Presentation Preference Workbench 实现导读

## 1. 为什么不能直接改 Canonical

Localogue 把“事实”和“我想怎样显示”分成两层。

例如 Community Pack 的人物实体把 A 设为默认头像，但用户更喜欢自己本地导入的 B。正确结果不是把 Person 的公共头像字段改成 B，而是在 Private Library 写：

```json
{
  "schemaVersion": 1,
  "id": "presentation_person_person_xxx",
  "entityType": "person",
  "entityId": "person_xxx",
  "preferredPortraitAssetId": "asset_b",
  "updatedAt": "..."
}
```

这样 Community / Shared Pack 仍然保持原样，当前用户的 Desktop 则优先显示 B。

## 2. Presentation Resolver

`apps/desktop/src/desktop-presentation.ts` 是纯函数层，不访问文件系统。

Work 候选只接受：

- `work.assetIds` 中真正存在的 `poster / cover`；
- `subjectType=work + subjectId=当前 Work` 的 `poster / cover`。

Person 候选只接受：

- `portraitAssetId / galleryAssetIds` 引用的 `portrait / gallery`；
- `subjectType=person + subjectId=当前 Person` 的 `portrait / gallery`。

解析优先级：

```text
Private Presentation Preference
        ↓ 无有效偏好
Canonical / Subject fallback
        ↓ 无图片
Placeholder
```

Preference 中存在 Asset ID，但 Asset 已不存在或不再属于当前实体时，Resolver 返回 `stalePreferredAssetId`。UI 会提示失效，但不会偷偷重写 Preference 或 Canonical。

## 3. 为什么 Desktop 使用专用 Native Command

`presentation-preferences` 既不是 Canonical Collection，也不是审计流水。

因此 V1-24A 没有把它塞进：

- `write_library_entity`；
- `write_private_audit_entity`。

而是新增：

```text
read_private_presentation_preferences
write_private_presentation_preference
```

Rust 端始终从 Desktop Settings 解析 Private Library 根目录，WebView 不能传任意写入目录。

## 4. Workbench 与详情页

Curation 内部新增两个子视图：

```text
Curation
├─ 完整度 / 重复
└─ 展示偏好
   ├─ Works
   └─ People
```

集中 Workbench 适合批量检查“哪些实体有私人偏好、哪些偏好失效”。

Work / Person Detail 的 Picker 则适合看到实体时直接调整当前首图。

两者最终都调用 `TauriLibraryRepository.savePresentationPreference()`，不会形成两套写入语义。

## 5. 删除保护

如果一个 Private Asset 正被 Presentation Preference 使用，Rust 的 `delete_library_entity(assets, id)` 会拒绝删除：

```text
Asset 仍被 Presentation Preference 引用；请先恢复默认展示图片。
```

这是为了避免用户删除图片后留下无声的悬空引用。

Shared Pack 消失、外部文件损坏等情况仍可能制造 stale Preference，所以 UI 仍必须具备失效检测。

## 6. 后续阶段状态

V1-24A 完成“选择与解析”。V1-24B 已继续完成：

- Person Portrait / Gallery 浏览与 Private 图片导入；
- Work 完整图片画廊（当前由 ADR-041 统一支持 poster / cover / gallery / fanart / screenshot）；
- Shared Pack Asset 的受控只读二进制解析；
- Private `asset-files/` 孤儿文件检查与安全清理。

V1-24C 继续处理 Portable Pack 的 Presentation / Asset 冲突预览、导入结果报告与迁移收尾。
