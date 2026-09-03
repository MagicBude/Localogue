# ADR-031：NFO 元数据目录与媒体目录解耦

## 状态

已接受，V1-16。

## 背景

真实媒体库里的 NFO 不一定与视频同目录。用户可能把视频分散在多个磁盘，而把 NFO 统一放在单独的资料目录；NFO 文件名也不一定与视频文件名完全相同。

如果 Localogue 只把 `.nfo` 当作“视频旁边的 sidecar”，会漏掉这一类已有资料库，并迫使用户重新整理目录结构。

## 决策

实例设置新增独立的 `nfoScanPaths`：

```text
mediaScanPaths  -> 视频 / MediaFile
nfoScanPaths    -> NFO 元数据输入
```

两组目录可以完全不重合。

NFO 识别顺序：

1. 优先读取 XML 内明确的番号字段；
2. XML 缺失番号时，再从 NFO 文件名保守提取番号；
3. XML 缺失发行日期或标题时，允许从文件名补充日期 / 片名；
4. 不能可靠得到番号时，不创建 Canonical Work。

文件名允许例如：

```text
SONE-123.nfo
SONE-123 2026-08-01 片名.nfo
2026-08-01 SONE-123 片名.nfo
ABW001_20250812_标题.nfo
```

NFO 批量导入必须先预览，再由用户明确点击导入。已有 Work 使用 fill / merge 策略，不静默覆盖已经存在的 Canonical 标题、日期、时长和简介。

媒体与作品仍通过番号匹配：NFO 创建 / 补充 Work 后，再运行增量媒体扫描即可把既有 MediaFile 重新绑定到新 Work；视频本身没有变化时不会重复执行昂贵 ffprobe / SHA-256。

## 与 Evidence / Review 治理的关系

Localogue 的长期不变量仍是“外部资料应可追溯、冲突应经过 Review / Commit Plan”。V1-16 为已有本地 NFO 资料库提供一个**窄范围 Bootstrap Ingest**：

- 扫描阶段只产生预览，不写 Canonical；
- 必须由用户明确点击导入；
- 新记录用于给空 / 半空 Private Library 打底；
- 已有 Work 只允许 fill / merge 缺失事实与精确关系，不允许 NFO 静默覆盖已有核心字段；
- 不开放 Canonical 删除；
- 这个例外不适用于在线 Provider、普通导入或一般编辑。

V1-17 将继续把 Desktop 的冲突修改、人工编辑和更广泛导入接入完整 Evidence / Review / Commit Plan / History。V1-16 不把 Bootstrap Ingest 描述成最终治理模型。

## 后果

### 好处

- 兼容独立 NFO 资料库；
- 不要求用户移动、重命名或重组已有媒体；
- NFO 与视频可以有不同命名方式，只要能得到同一番号；
- 继续保持 Work 与 MediaFile 分离；
- 批量导入不会因为一个 NFO 重复覆盖已有人工事实。

### 代价

- 没有番号的 NFO 只能进入待处理状态，不能安全自动归档；
- 同一番号存在多个 NFO 时需要去重；V1-16 选择元数据更完整、修改时间更新的一份作为导入候选；
- 自动创建的人物 / Maker / Series / Genre 只做规范化精确复用，不做模糊别名猜测，后续仍可能需要治理合并。
