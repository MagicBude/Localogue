# V1-22 Hotfix 2 Manifest · Adaptive Work Media Gallery & Fluid Desktop Layout

## 背景

V1-22 Hotfix 将 Work Detail 调整为“顶部媒体画廊 + 下方全宽 Metadata Table”后，实机继续暴露两个纯 Presentation 问题：

1. Gallery Stage 使用固定横向高度策略。纵向 poster / cover 虽然 `object-fit: contain` 不会主动裁切，但在宽屏横向画布里会被压得过小，视觉上只占中间很小区域；
2. Desktop 主内容区仍保留历史 `max-width: 1460px` 思路。在 2K / 4K 或较宽桌面窗口中，右侧会留下明显无效空白，Works Table / Facet / Detail 无法利用可用空间。

## 修复

### 自适应 Work Media Gallery

- Gallery 不再把所有 Asset 强制放进同一个固定横向展示策略；
- `WorkAssetGallery` 根据当前图片真实 `naturalWidth / naturalHeight` 判断：
  - `portrait`：纵向；
  - `landscape`：横向；
  - `square`：近似方形；
- 在图片尚未加载前，`poster / cover / portrait` 使用纵向预判，避免首帧先被横向画布压缩；
- 图片加载完成后以真实宽高比覆盖预判；
- portrait Stage 使用更高的 `vh` 高度上限，纵向海报可完整、明显地展示；
- landscape / square 使用各自独立高度策略；
- 所有类型继续使用 `object-fit: contain`，不通过裁切换取填满；
- 当前 Gallery 仍只读取当前图片，不一次性加载全部 Asset；
- 左右箭头、类型标签、当前序号和未来视频预览扩展入口保持不变。

### 流式 Desktop 主内容区

- `.content-shell` 移除固定 `1460px` / 固定 Desktop 最大宽度；
- 主内容区跟随 Desktop 可用 Grid Track 流式伸展；
- 使用响应式 `clamp()` 控制左右 padding，而不是通过固定内容宽度制造空白；
- 超宽屏继续适当增加 Facet Rail 宽度和页面 padding，但 Results Track 始终使用剩余空间；
- Works Table、海报墙、列表、Browse、People 与 Work Detail 都可使用更大的 Desktop 窗口；
- 阅读型长文本仍由其自身 `max-width` 约束，不让正文在 4K 屏幕横跨整行。

### 版本显示

- Desktop 顶栏不再硬编码 `V1-20`；
- 顶栏阶段标识改为读取 Runtime Version，避免后续覆盖升级后 UI 仍显示旧阶段编号。

## 回归边界

Desktop Boundary Validator 新增：

- Gallery 必须保留基于真实图片宽高比的 portrait / landscape / square 策略；
- `.content-shell` 必须保持流式宽度，不允许恢复固定 `1460px max-width`；
- V1-22 Hotfix 1 的顶部 Gallery + 下方全宽 Metadata Table 结构继续强制保留；
- Native 删除类型白名单同步、V1-21 Vocabulary Governance、V1-18 Native I/O / Unified Library 安全边界保持不变。

## 不变边界

- 不修改 Canonical Schema；
- 不修改 NFO / Asset Import；
- 不修改 Source Genre Catalog；
- 不修改 Rust Native I/O / Windows Scanner；
- 不扩大 Tauri 权限；
- Shared Pack 继续 Native 强制只读；
- 产品版本继续保持 `0.1.22`，作为 V1-22 Presentation Hotfix。
