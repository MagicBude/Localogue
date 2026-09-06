# Desktop 元数据共享发现

## 为什么需要这一层

Unified Library Root 通常同时包含视频、NFO 和图片。旧实现为了保持 NFO Importer 与 Asset Importer 独立，会让两者分别递归遍历同一个目录；目录规模增大后，大量重复的目录枚举比解析几个 JSON 更浪费 I/O。

`desktop-metadata-discovery.ts` 只合并“发现文件”这一步：

1. 按规范化根路径合并 NFO 与图片扫描计划；
2. 同一根目录一次请求 `.nfo` 与受支持图片扩展名；
3. 按扩展名把不可变文件条目快照分流给两个 Preview；
4. NFO 与图片各自继续负责解析、保守匹配和预览状态。

这样没有创建第二套 Importer，也没有让 React 页面参与番号匹配。

## 为什么媒体扫描仍然独立

媒体扫描拥有任务互斥、取消信号、廉价变化指纹、ffprobe 和 stale 技术参数规则。把它并入元数据 Preview 会让一次普通目录发现承担长任务生命周期，也会削弱用户取消扫描的能力。

当前常见 Unified Root 从三次遍历减少为两次：一次 NFO + 图片共享发现，一次可取消的媒体增量扫描。未来若 Native Walker 支持可复用、可取消并带目录版本的完整 Snapshot，再评估三类文件共享一次遍历。

## 为什么 Preview 仍保留自行扫描入口

`previewNfoImport` 与 `previewLocalAssetImport` 的可选 `discoveredEntries` 参数用于编排优化。调用方不传快照时，它们仍能独立工作，方便高级预览、测试以及未来其它宿主复用。传入快照后，Preview 只做自己的解析和匹配，不再次访问目录树。
