# Localogue V1-20 Manifest

## 阶段

**Desktop UX & I18N Parity**

V1-20 在 V1-19 Discovery / Presentation Parity 之上继续收口 Desktop 日常使用体验，不修改已经通过 Windows 实机验证的 V1-18 Hotfix 3 Unified Library / Native I/O 核心。

## 本版完成

### Desktop 布局

- 主导航默认宽度收窄；
- 主导航支持显式折叠 / 展开；
- 折叠状态本机持久化；
- Topbar 支持语言控制并自动换行；
- Work Facet Rail 扩展为更宽的响应式布局；
- 长 Facet 文本允许换行，避免 Maker / Series / Genre 等选项被截断。

### Asset Presentation

- `poster` 显示为海报 / ポスター / Poster；
- `fanart` 显示为背景图 / 背景画像 / Background；
- `screenshot` 显示为缩略图 / サムネイル / Thumbnail；
- `cover` 保留封面 / カバー / Cover 的兼容语义；
- Work Detail Asset 顺序固定为 `poster -> fanart -> screenshot -> cover -> others`；
- 移除“本地海报 / 封面 / Fanart”这类混合语言标题。

### Desktop 三语

- 新增 `DesktopI18nProvider`；
- 支持 `zh-CN / ja / en` 三种 UI 语言；
- UI Language 与 Metadata Language 独立；
- 默认 UI `zh-CN`、Metadata `ja`；
- 偏好分别持久化到 `localogue_ui_language` 与 `localogue_metadata_language`；
- 实体标题、人物名、组织名等展示尊重 Metadata Language；
- 语言切换只影响 Presentation，不修改 Canonical；
- Desktop Boundary Validator 会扫描所有字面量 `t()` key，强制日文 / 英文翻译表完整且 key 集合一致；
- 首页统计、媒体扫描统计、NFO / Asset 统计、ffprobe 信息、Work 编辑器与 Works 表格等残余硬编码标签统一进入 i18n。

### 保持不变的安全边界

- Web/Desktop 继续共用 `library-query`；
- Shared Pack 继续 Native 强制只读；
- V1-18 Hotfix 3 的 Native I/O worker、堆 SHA 缓冲、Windows 扫描防环与特殊卷兼容保持不变；
- V1-18 的 Private Asset Reader 与 V1-19 多维筛选保持不变；
- 不新增通用文件读写或 Shell 权限。

## 明确留到 V1-21

- Evidence / Review / Commit Plan；
- Curation；
- History / Restore；
- Portable Pack 完整 Desktop 导入导出；
- 更完整 Presentation Preference Workbench；
- 更广泛治理页面的 Desktop 对齐。

## 本机验收

```bash
pnpm install
pnpm check
pnpm desktop:rust:check
pnpm desktop:dev
```

重点检查：

1. Sidebar 默认更窄，折叠状态重启后保留；
2. Works / Person related Works 的 Facet Rail 更宽，长文本不再被硬截断；
3. Work Detail Asset 顺序为海报、背景图、缩略图、封面、其他；
4. 顶部 UI / Metadata 两个语言选择器可独立切换；
5. 中文 / 日本語 / English UI 均覆盖主要 Desktop 页面；
6. Metadata Language 切换只改变展示名称，不修改资料库文件；
7. Unified Library 同步仍保持 V1-18 Hotfix 3 的稳定行为。
