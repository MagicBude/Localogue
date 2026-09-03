# ADR-034：Desktop 本地 Asset 使用受限 IPC 读取，Unified Library 使用显式顺序同步

## 状态

已接受，V1-18。

## 背景

V1-17 已经可以把本地 `poster / cover / fanart / thumb` 导入 Private Library，并把 Asset 关联到 Work，但 Desktop 仍有两个实际问题：

1. React WebView 没有安全的本地图片读取通道，所以 Works 页面即使已有 Asset 也只能画占位符；
2. 媒体扫描、NFO 导入和 Asset 导入仍是分开的动作，用户很容易只扫描出 MediaFile，却没有同步 Work / Asset，形成 `Media > 0 / Asset = 0` 的半同步状态。

直接为动态 Private Library 开启宽泛 `asset://` 文件范围，会把用户选择的本地目录扩大成 WebView 可直接访问的文件面。Localogue 不接受这个边界。

## 决策一：本地图片只通过受限 Native IPC 读取

新增 `read_private_asset_bytes(storagePath)`：

- `storagePath` 必须是相对路径；
- 禁止 `..` 路径穿越，并 canonicalize 根与目标防止符号链接逃逸；
- Rust 自行读取 Desktop Settings 中当前 Private Library；
- 最终路径必须位于 `<Private Library>/asset-files/`；
- 只允许受支持图片扩展名；
- 限制单文件大小并再次校验 magic bytes；
- 成功后以 IPC bytes 返回，React 创建短生命周期 Blob URL。

因此 Desktop 能实际显示 Private poster，而不需要给 WebView 任意本地文件读取权限。

## 决策二：Works 三种视图共享同一查询结果

Desktop 增加与 Web 对齐的：

- 海报墙；
- 列表；
- 表格。

三种模式只改变 Presentation，不允许各自发起不同业务查询。搜索、排序、分页和数据合并继续使用同一个 `LibraryRepository + library-query` 结果，避免视图之间产生结果漂移。

## 决策三：Unified Library 一键同步固定顺序为 NFO → Asset → Media

新增显式“同步资料库”动作：

```text
NFO Preview / Import
        ↓
重新发现并关联 Asset
        ↓
Media 增量扫描与 Work 匹配
```

必须先导入 NFO，因为新的 Work 可能由 NFO 创建；随后图片才能安全挂到这些 Work；最后媒体扫描才能使用最新 Canonical Work 重新匹配。

该动作仍是用户明确发起的同步，不是后台静默修改。高级用户仍可分别执行“仅扫描视频”和“NFO + 图片 Preview / Import”。

## 后果

- Desktop 作品页可以真正显示本地 poster；
- Work 详情可以显示首图和关联 Asset 预览；
- 用户只配置一个 Unified Library Root 后即可用一次显式操作完成常见存量库同步；
- 不扩大 Tauri asset protocol / Shell 权限；
- V1-18 仍不等价于完整 Evidence / Review / History 治理迁移。
