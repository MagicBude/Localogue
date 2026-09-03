# ADR-036：Desktop 将 UI 语言与元数据语言作为独立展示偏好

状态：已接受，V1-20。

## 背景

Localogue Web 已经区分两类语言偏好：

- **UI 语言**：决定按钮、导航、筛选器、提示语等界面文案；
- **元数据语言**：决定 Work、Person、Organization 等多语言字段的优先展示语言。

Desktop 在 V1-19 以前大部分界面仍固定使用中文，实体名称又大量固定以日文展示。这会导致两个问题：一是 Web/Desktop 的使用体验不一致；二是用户无法表达“中文界面 + 日文元数据”或“英文界面 + 中文元数据”这类实际需求。

## 决策

Desktop V1-20 将 UI 语言与元数据语言作为两个独立、本机持久化的 Presentation Preference。

支持值与 Web 保持一致：

- `ja`；
- `zh-CN`；
- `en`。

默认语义与 Web 保持一致：

- UI：`zh-CN`；
- Metadata：`ja`。

Desktop 使用本地存储键：

- `localogue_ui_language`；
- `localogue_metadata_language`。

Web 因 Server Component / Request Context 需要使用 Cookie；Desktop 没有同样的服务端渲染约束，因此允许使用 localStorage。**状态载体可以不同，但偏好含义、支持值与默认语义必须一致。**

## 展示约束

1. 改变 UI 语言不得修改 Canonical Library。
2. 改变元数据语言也只影响展示优先级，不得复制或覆写 Work / Person / Organization。
3. Desktop Query Core 继续使用既有稳定 ID 和结构化条件；语言切换不得改变筛选业务语义。
4. Canonical Asset type 保持 schema 原值，例如本地 `thumb/thumbnail` 导入后仍使用 `screenshot` 类型；UI 仅将其展示为“缩略图 / サムネイル / Thumbnail”。
5. Work Asset 的 Presentation 顺序固定为 `poster -> fanart -> screenshot -> cover -> 其他`，避免标签与图片顺序产生歧义。
6. Sidebar 折叠状态、Works 三视图等同样属于本机 Presentation Preference，不进入 Canonical 数据。

## 结果

用户可以自由组合：

- 中文 UI + 日文元数据；
- 日文 UI + 日文元数据；
- 英文 UI + 中文元数据；
- 以及其他支持组合。

这让 Desktop 与 Web 在语言偏好语义上保持一致，同时继续遵守 Localogue 的“展示偏好不污染 Canonical”原则。
