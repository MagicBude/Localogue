# Desktop 资料库配置与资料源

V1-24 Foundation Cleanup 将 Desktop 的路径设置分成两个层次：**Library Profile（资料库配置）** 与 **Profile 内的资料源**。

目标是让用户可以建立多个彼此独立的资料库，并在侧边栏快速切换，而不是每次手工改一组目录。Localogue 不预设资料库的内容分类，除内置开发 Fixture 固定叫“示例库”外，其余新建资料库只使用“资料库 1 / 资料库 2 …”这类中性默认名。

## 先记住一个最简单的模型

一个资料库配置可以理解成：

```text
资料库：资料库 1
├─ 私人资料库（可写）        D:/Localogue/Libraries/library-1
├─ 内容根目录（推荐）        E:/Media-A
├─ 只读共享资料              D:/Localogue/Packs/common-a
└─ 高级兼容目录              可选
   ├─ 额外媒体目录           F:/Archive-A
   └─ 额外 NFO / 图片目录    G:/Metadata-A
```

另一个配置可以完全不同：

```text
资料库：资料库 2
├─ 私人资料库（可写）        D:/Localogue/Libraries/library-2
├─ 内容根目录（推荐）        H:/Media-B
├─ 只读共享资料              D:/Localogue/Packs/community-b
└─ 高级兼容目录              空
```

切换 Profile **不会复制或移动任何媒体文件**。它只是一次性切换当前 Desktop 使用的整组路径，并重新打开相应的 Canonical / Shared 数据视图。

## 四种路径分别是什么

### 1. 私人资料库（Private Library）

这是 Localogue 自己维护的**可写结构化资料目录**。

它保存：

- Canonical Work / Person / Organization / Series / Genre / Tag；
- Private Asset 元数据与 `asset-files/`；
- MediaFile；
- Evidence、Commit、Snapshot、Restore、Provenance 等审计数据；
- Presentation Preference。

普通用户通常应该给每个 Library Profile 配一个不同的 Private Library，从而真正隔离不同资料库的私人事实、扫描结果和展示偏好。

### 2. 内容根目录（Content Root / Unified Library Root）

这是**推荐的日常入口**。

它可以同时包含：

```text
E:/Media-A/
├─ Movie A/
│  ├─ MOVIE-A.mkv
│  ├─ MOVIE-A.nfo
│  └─ MOVIE-A-poster.jpg
├─ Movie B/
│  └─ ...
└─ Archive/
   └─ ...
```

Localogue 会递归发现受支持的视频、NFO 和图片；目录名本身没有特殊语义，最后按番号 / Work 关系汇聚。

**如果你的资料已经能放在一个或几个共同父目录下，只配置这里即可。**

### 3. 只读共享资料（Shared Pack）

Shared Pack 是公共基础元数据，不是你的私人库。

读取优先级：

```text
Private Library
    > Shared Pack 1
    > Shared Pack 2
    > ...
```

因此 Shared Pack 很适合社区共同维护的人物、作品、厂商、系列、Genre 等事实数据。用户自己的修正始终可以通过 Private Override 覆盖它。

`localogue-community-data` 就应该以这种方式接入，而不是复制进每个私人资料库。

### 4. 高级兼容目录

只有旧目录结构无法整理到 Content Root 下时才需要。

- **额外媒体目录**：只扫描视频；
- **额外 NFO / 图片目录**：补充发现元数据与图片。

普通用户可以一直保持折叠和空白。

## Library Profile 保存什么

Profile 保存：

- `libraryPath`；
- `libraryRoots`；
- `mediaScanPaths`；
- `nfoScanPaths`；
- `sharedPackPaths`。

以下是真正的应用级设置，不随 Profile 切换：

- `ffprobePath`；
- Localogue Web URL；
- UI / 元数据语言；
- 主题等显示偏好。

## 如何建立多个资料库

推荐流程：

1. 点击“新建资料库”，Localogue 会创建并立即保存一个不指向任何路径的“资料库 1”；
2. 为它选择 Private Library，并按需添加 Content Root / Shared Pack；路径编辑完成后点击“保存设置”；
3. 再次点击“新建资料库”，会得到“资料库 2”；原有 Profile 不会被覆盖；
4. 用户可以随时把这些中性名称改成自己需要的名字；重命名、删除、切换都会立即持久化；
5. 点击“添加示例库”时，Desktop 会自行把内置 Fixture 复制到 App Local Data，并立即加入固定名称“示例库”。普通用户不需要安装 pnpm，也不需要知道仓库目录。

之后侧边栏会出现资料库选择器，可以直接切换；重启 Desktop 后 Profile 列表和当前选择仍应保持。

## 切换时发生什么

Desktop 会：

1. 读取目标 Profile；
2. 整组替换路径字段；
3. 保存 Desktop Settings；
4. 重新检查 Shared Pack；
5. 重新建立 Repository 读取根；
6. 清除当前详情页，避免在新资料库里继续显示旧实体。

不会：

- 移动媒体；
- 合并两个 Private Library；
- 自动把一个库的数据复制到另一个库；
- 修改 Shared Pack。

如果设置页还有未保存的路径变化，从侧边栏切换时会先提示，避免静默丢掉草稿。

## “同步资料库”与多个目录

一键同步顺序仍然是：

```text
NFO
  ↓
Local Asset
  ↓
Media Scan
```

V1-24 Foundation Cleanup 开始，一键同步会**等待 Media Scan 把全部有效媒体根目录扫描完**后才报告完成；Media 页面也会列出“本轮实际扫描的目录”。

因此如果配置：

```text
额外媒体目录 A
额外媒体目录 B
```

“同步资料库”和“仅扫描视频”都应使用同一组去重后的有效根目录，不再出现前者看起来只完成第一个、后者又补出第二个的状态差异。

## Profile 与物理隔离

Profile 是“整组路径预设”，不是 OS 沙箱。

如果两个 Profile 故意指向同一个 Content Root，它们当然仍会看到同一批磁盘媒体；如果两个 Profile 指向同一个 Private Library，它们也会读写同一套 Canonical 数据。

想真正隔离两个收藏，应至少让它们使用不同的 Private Library。资料库名称只是用户界面标签，不决定内容类型。

## 示例库的长期角色

`examples/dev-library` 不再只服务开发者。它同时承担：

- 开发 Fixture；
- 手工验收数据；
- 未来 E2E Fixture；
- 新用户第一次打开 Localogue 时的功能展示库。

当前 Git 模板仍然是 Fixture 的唯一事实源。Desktop Bundle 会把同一套模板作为只读应用资源嵌入；用户点击“添加示例库”时，Native Runtime 将它复制到 App Local Data 的可写 `example-library` 运行副本。

开发者仍可使用 `pnpm desktop:demo:reset` 重置仓库内的 `var/dev-fixture-library` 做脚本 / 手工验收，但它不再是产品 UI 的使用前提。安装版与开发版的“添加示例库”都必须由 Desktop 自己完成初始化。

## Profile 持久化与异常回退

V1-24 Persistence Hotfix 规定：

- Profile 列表一旦存在，就是资料库配置的事实源；旧版平面路径字段不允许再次生成“幽灵 Profile”；
- 新建、切换、重命名、删除 Profile 都会立即写入 Desktop Settings，不依赖用户再补点一次“保存设置”；
- 路径字段本身仍使用“保存设置”提交，避免选择目录时频繁写盘；
- `activeLibraryProfileId` 缺失或指向不存在的 ID 时，TypeScript 与 Rust 都回退到现有列表第一项；
- 只有 `libraryProfiles` 真正为空时，侧栏才显示“尚未创建资料库”；
- 示例库初始化失败时应提示安装资源缺失，而不是要求普通用户执行开发命令。
