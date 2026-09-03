# ADR-032：统一资料源根目录与按番号汇聚本地 Asset

## 状态

已接受，V1-17。

## 背景

V1-16 证明了 NFO 不能被假设为视频旁边的 sidecar。进一步观察真实资料库后，还存在更常见的目录组织方式：用户在一个大的收藏根目录下，把视频、NFO、海报、Fanart、缩略图、字幕等按用途拆到不同子目录。

例如：

```text
石川澪 DMM原档合集/
├─ VR/
├─ 单体/
├─ 封面+元数据/
│  ├─ 2021-10-01 MIDE-974 ... .nfo
│  ├─ 2021-10-01 MIDE-974 ...-poster.jpg
│  ├─ 2021-10-01 MIDE-974 ...-fanart.jpg
│  └─ 2021-10-01 MIDE-974 ...-thumb.jpg
├─ 写真/                 # 视频分类目录
└─ 字幕/
```

如果 Localogue 要求用户分别配置每个子目录，或者要求图片/NFO/视频同名同目录，就会把用户已有的合理目录结构变成产品限制。

## 决策

实例设置增加 `libraryRoots`，作为首选的 **Unified Library Source**：

```text
libraryRoots
  -> recursive discovery
      -> video     -> MediaFile
      -> .nfo      -> NFO Preview / Bootstrap Import
      -> poster    -> Asset(type=poster)
      -> fanart    -> Asset(type=fanart)
      -> cover     -> Asset(type=cover)
      -> thumb     -> Asset(type=screenshot)
```

`mediaScanPaths` 和 `nfoScanPaths` 保留为高级/兼容补充路径，支持“视频和元数据真的在完全不同磁盘”的情况。重叠根目录按规范化文件路径去重。

**目录位置不是关联主键。** Work、NFO、MediaFile 和本地图片最终以规范化作品番号汇聚；NFO 与图片还允许同 stem 作为保守 fallback。

## 本地图片写入策略

本地图片不直接引用用户原始文件作为 Canonical Asset 存储。用户明确点击导入后：

1. Rust 校验扩展名、文件大小与图片 magic bytes；
2. 计算 SHA-256；
3. 将原图复制到当前 Private Library 的 `asset-files/<sha256>.<ext>`；
4. 原文件保持不动；
5. 创建 `Asset` JSON，并设置 `subjectType=work` / `subjectId=<workId>`；
6. Asset ID 同时加入 `Work.assetIds`，使现有封面解析规则可以直接找到 `poster / cover`。

Shared Pack 仍只读。Webview 不能指定任意写根；Rust 从 Desktop Settings 解析 Private Library。

## 图片角色识别

V1-17 只自动导入文件名明确带角色后缀的图片，避免把根目录中截图、素材等普通 JPG 错挂到 Work。`写真/` 只是用户的一个视频分类目录示例，目录名不会影响文件角色判断：

- `-poster` -> `poster`
- `-cover` -> `cover`
- `-fanart` / `-background` / `-backdrop` -> `fanart`
- `-thumb` / `-thumbnail` / `-screenshot` -> `screenshot`

没有明确角色后缀的图片只出现在 Skip 统计中，不自动写入。

## NFO 多来源分组

同番号的 `part1 / part2 / ...` NFO 不再作为几十条“重复番号”展示，而是聚合为一个 Work Group：

```text
MDVR-195 · 6 NFO sources
```

组内仍选一份最完整的 NFO 作为 Canonical Bootstrap 候选，其余来源保留在预览里供用户核对。

## 后果

### 好处

- 一个大目录只需添加一次；
- 不要求视频、NFO、封面同目录或同名；
- 与 V1-16 的独立路径场景兼容；
- `poster/fanart/thumb` 可以在 NFO 创建 Work 的同一次显式导入中直接挂到作品；
- 原始用户文件不移动、不删除；
- 同内容图片用 SHA-256 内容寻址，避免 Private Asset 重复占空间；
- 写权限继续停留在 Private Layer。

### 代价

- V1-17 仍采用保守文件名角色识别；无明确后缀的图片需要后续人工关联能力；
- Desktop 当前先显示 Asset 类型和存储引用，直接二进制预览/封面墙仍属于后续 Native Presentation 增强；
- 完整 Work/Person 编辑、Evidence/Review/History、Portable Pack 等交互对齐仍需继续推进。
