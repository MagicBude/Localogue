# V1-20 Desktop UX & I18N Parity 实现导读

V1-19 已经补齐 Desktop 的首页海报、完整 Work Facet、People 高级筛选、Person 相关作品二次筛选与 Catalog Browse。实机使用继续暴露出一组纯 Presentation / UX 差距：筛选栏过窄、左侧主导航占用空间、Asset 标签和排序不一致，以及 Desktop 尚未接入 Web 已有的中 / 日 / 英语言偏好。

V1-20 不再修改已经通过 Windows 实机验证的 Unified Library / Native I/O 链路，而是集中关闭这些桌面展示差距。

## 1. 主导航：默认更窄，并允许手动折叠

Desktop 默认 Sidebar 从此前较宽布局收窄，并提供显式折叠按钮。

折叠后只保留短标识，状态写入：

```text
localogue.desktop.sidebar-collapsed
```

因此用户把导航收起后，下次打开 Desktop 仍保持同一布局。这个偏好只属于当前 Desktop，不进入 Canonical Library。

## 2. Facet Rail：给筛选条件真正可读的空间

V1-20 将作品探索页的 Facet Rail 提升到约 330–380 px，并允许选项文字换行。响应式布局在中等宽度下逐步收窄，在较窄窗口下改成单列，而不是继续把长 Maker / Series / Genre 文本截断在一个很窄的侧栏里。

这里只改变 Presentation；查询仍然是：

```text
DesktopWorkExplorer
  -> TauriLibraryRepository
  -> queryWorks()
```

没有复制新的 Facet 算法。

## 3. Asset 语义与顺序

Canonical Asset 类型与用户看到的语义标签分离：

| Canonical type | 中文 | 日本語 | English |
| --- | --- | --- | --- |
| `poster` | 海报 | ポスター | Poster |
| `fanart` | 背景图 | 背景画像 | Background |
| `screenshot` | 缩略图 | サムネイル | Thumbnail |
| `cover` | 封面 | カバー | Cover |

其中外部文件名里的 `thumb / thumbnail` 在现有 Canonical Schema 中仍映射为 `screenshot`。V1-20 不为了 UI 文案修改 Schema，只改变展示名称。

Work Detail 固定按照：

```text
poster -> fanart -> screenshot -> cover -> 其他
```

排列，因此标签和下方图片不再出现顺序错位。

## 4. UI Language 与 Metadata Language 分离

Desktop 新增 `DesktopI18nProvider`，支持：

- 中文；
- 日本語；
- English。

顶部提供两个独立选择器：

- 界面语言；
- 元数据语言。

例如“中文界面 + 日文作品标题”是合法且推荐的组合。

本地存储键与 Web 语义保持一致：

```text
localogue_ui_language
localogue_metadata_language
```

Desktop 默认 UI 为 `zh-CN`，Metadata 为 `ja`。改变任何一个偏好都不会写 Canonical Library。

## 5. 覆盖范围

V1-20 的 Desktop i18n 覆盖：

- 主导航与 Topbar；
- Home；
- Works / People / Browse；
- Work / Person Detail；
- Media；
- Packs；
- Settings；
- Work / Person CRUD；
- Media 手工绑定；
- Facet、分页、空状态与常用操作提示。

运行时底层扫描 Progress 中的少量技术诊断仍可保留为内部文本；它们不是 Canonical 内容，也不改变查询行为。

## 6. V1-20 不做什么

V1-20 是 **UX / I18N Parity**，不是治理工作台完成版。以下继续进入 V1-21：

- Evidence / Review；
- Commit Plan；
- Curation；
- History / Restore；
- Shared / Personal Portable Pack 完整导入导出；
- 更完整的 Presentation Preference Workbench。

这样可以避免再次把“日常浏览体验已经接近 Web”误写成“Web 所有治理能力已经迁移”。
