# Localogue V1-10 Manifest

## 版本主题

**Asset、Presentation Preference 与本地 MediaFile 管理。**

V1-10 建立“公共事实资料、用户显示偏好、本机文件状态”三者的边界，并实现第一批真实图片/媒体文件能力。

## 核心实现

### Asset

- `Asset` 增加 `subjectType / subjectId`；
- 新增 Private Asset 上传服务；
- 上传支持 JPEG / PNG / WebP / GIF / AVIF；
- 用户 SVG 暂不允许上传；
- 图片二进制使用 SHA-256 内容寻址；
- Asset Entity ID 使用 subject + type + content hash 生成，避免同图跨实体元数据冲突；
- PNG / GIF / JPEG / 部分 WebP 可直接读取尺寸；
- Asset JSON 与图片二进制分离；
- 新增 Asset Content Route，统一读取 Private / Shared Pack / Demo 资源；
- 路径解析执行根目录越界检查。

### Presentation Preference

- 新增 `PresentationPreference` Domain Model；
- 新增 `presentation-preferences/` 私人存储；
- 支持人物 `preferredPortraitAssetId`；
- 支持作品 `preferredCoverAssetId`；
- 人物卡片、人物详情、作品卡片、作品详情统一应用偏好；
- 用户选择图片不要求复制整个 Shared Person / Work；
- Preference API 验证 Asset 必须属于当前实体或已被 Canonical Entity 引用。

### MediaFile

- `MediaFile.workId` 改为可选；
- 新增扩展名、实际时长、分辨率、容器、视频/音频编码、Hash、扫描根等字段；
- 新增 `/media` 页面；
- 新增 `/api/media/scan`；
- 设置页支持多个媒体扫描目录；
- 设置页支持自定义 `ffprobe` 路径；
- 递归扫描常见视频扩展名；
- 使用规范化番号从文件名进行保守 Work 匹配；
- 使用 `execFile()` 调用 ffprobe，不拼接 Shell 命令；
- 视频 SHA-256 为显式可选操作；
- MediaFile 只读取 Private Library；
- Shared Pack 中即使出现 `media-files/` 也不会加载；
- `hasMedia` 作品筛选优先依据 `MediaFile.workId`，同时兼容早期 `work.mediaFileIds`。

## Web 页面

新增：

```text
/media
```

增强：

```text
/settings
/people/[id]
/works/[id]
```

新增 API：

```text
POST /api/assets/upload
GET  /api/assets/[id]/content
PUT  /api/presentation/[entityType]/[id]
POST /api/media/scan
```

## 数据目录

Private Library 新增/正式启用：

```text
assets/
asset-files/
presentation-preferences/
media-files/
```

## 校验

`validate:data` 新增：

- Asset subject 引用；
- MediaFile → Work 引用；
- MediaFile 基本数值字段。

`validate:audit` 新增：

- Presentation Preference 基础结构；
- 私人 Asset 引用的基础检查。

## 文档

新增：

- `docs/architecture/asset-presentation-resolution.md`
- `docs/architecture/mediafile-private-layer.md`
- `docs/development/v1-10-assets-and-media-walkthrough.md`
- `docs/storage/asset-files.md`
- `docs/ui/media-library.md`
- `docs/decisions/ADR-021-presentation-preference-does-not-copy-shared-entity.md`
- `docs/decisions/ADR-022-mediafile-is-private-only.md`
- `schemas/asset.schema.example.json`
- `schemas/media-file.schema.example.json`
- `schemas/presentation-preference.schema.example.json`

同时更新：

- `README.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `AGENTS.md`
- `docs/README.md`
- `docs/product/roadmap.md`
- `docs/data-model/asset.md`
- `docs/data-model/media-file.md`
- `docs/architecture/presentation-preferences.md`
- `docs/storage/assets.md`
- `docs/ui/settings.md`
- `data/README.md`
- `schemas/README.md`

## 实际回归验证

### MediaFile

生成实际 2 秒测试 MP4：

```text
DEMO-001-test.mp4
```

验证结果：

- 发现文件：1；
- 匹配 `work_demo_001`：成功；
- ffprobe：成功；
- 分辨率：320×180；
- 视频编码：H.264；
- 音频编码：AAC；
- 实际时长：2 秒；
- 完整文件 SHA-256：成功。

### Asset

使用实际 PNG 字节验证：

- SHA-256：成功；
- PNG 尺寸读取：1×1；
- Private Asset JSON：成功；
- Presentation Preference：成功；
- 最终头像解析：成功。

额外验证同一图片上传给两个人物：

- 底层二进制路径相同，实现内容去重；
- Asset Entity ID 不同，不发生 subject 元数据覆盖。

### 数据完整性

临时私人资料库：

```text
works          8
people         6
organizations  4
series         3
genres         15
tags           6
assets         14
mediaFiles      1
```

结果：

- Canonical 校验：通过；
- Audit 校验：通过；
- V1-10 Backend 内部严格类型检查：通过；
- V1-10 新增 UI/API 内部类型关系检查：通过；
- 148 个 TS/TSX 源码语法检查：0 错误。
- 修复 Node.js 24 Readable Stream `data` 回调类型兼容问题。
- 清理 Commit Plan `updatedAt` 排除逻辑产生的 ESLint warning。

## 下一阶段

V1-11：MediaFile 绑定治理、Asset 治理与资料包便携分享。
