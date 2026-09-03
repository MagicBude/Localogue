# NFO

NFO 是 Localogue 的一等元数据输入格式，但不要求它与视频文件相邻。

## NFO 来源

### 视频旁 Sidecar

媒体扫描仍会观察视频目录中的 `.nfo`，把路径记录到 `MediaFile.sidecars.nfoPaths`。这属于“这个视频旁边发现了什么”的 Observation。

### Unified Library Root（V1-17 首选）

如果视频、NFO 和海报只是位于同一收藏根目录的不同子目录，只需配置共同父目录：

```text
E:\Library\石川澪 DMM原档合集  <- libraryRoots
  ├─ VR/
  ├─ 单体/
  └─ 封面+元数据/
```

Localogue 会递归发现 NFO，不要求它与视频同目录。

### 独立 NFO 元数据目录（高级兼容）

V1-16 的 `nfoScanPaths` 仍然保留。NFO 可以集中存放在完全独立的目录树：

```text
D:\Media\...          <- mediaScanPaths
D:\Metadata\NFO\...  <- nfoScanPaths
```

两者不需要同目录、同名或一一相邻。

## 识别顺序

Localogue 优先相信 NFO XML 内明确字段：

- 番号；
- 标题 / 原始标题；
- 演员；
- 导演；
- Maker / Studio；
- Series；
- Genre / Tag；
- 发行日期；
- 时长；
- 简介。

XML 缺字段时，文件名可作为辅助来源。

支持的典型文件名：

```text
SONE-123.nfo
SONE-123 2026-08-01 片名.nfo
2026-08-01 SONE-123 片名.nfo
ABW001_20250812_片名.nfo
300MIUM-123 2025.01.02 片名.nfo
```

其中 `ABW001` 会规范化为 `ABW-001`。日期和片名只是补充字段，不用于替代番号主键。

## Desktop 批量导入

1. 在 Desktop 设置中优先添加一个或多个 **Unified Library Root**；完全独立的 NFO 目录再使用高级 `nfoScanPaths`；
2. 打开“本地资料”；
3. 点击“扫描资料源”；
4. 查看 NFO Work Group、番号、标题与解析状态；
5. 同一页面还会预览 `poster / cover / fanart / thumb` 本地图片候选；
6. 点击“导入元数据与图片”；
7. 再运行媒体增量扫描，用番号把现有 MediaFile 绑定到 Work。

新 Work 会创建基础 Canonical 记录，并对人物、Maker / Label、Series、Genre、Tag 做规范化精确复用；不存在时创建 Private Entity。

已有 Work 使用 **fill / merge**：缺失字段可以补齐，关系可以合并，但不会用 NFO 静默覆盖已经存在的标题、发行日期、时长或简介。

## 安全边界

- NFO Reader 只允许读取 `.nfo`；
- 单文件上限 10 MB；
- 写入只发生在用户明确点击导入之后；
- Shared Pack 保持只读；写入目标只能是 Private Library；
- 无法可靠识别番号的新 NFO 不自动创建 Work。
