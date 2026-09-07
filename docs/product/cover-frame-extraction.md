# 本地视频抽帧生成封面（Cover Frame Extraction）

Localogue 现在支持从作品**本地可读取的视频文件**中截取一帧，作为该作品的私人封面。该功能完全离线、依赖本地 `ffmpeg`，并且**只写入私人展示偏好层**，不修改 Canonical Work、不进入 Shared Pack，符合 V1-10「展示偏好属于私人层」的治理原则。

## 为什么要抽帧

作品扫描（`MediaFile`）只记录影片技术参数与路径，封面仍然需要人工导入或来自同目录 sidecar。当用户已经有本地视频、却不想手动找封面时，直接从视频里截一帧是最快的起点：

- 抽出来的帧是“用户想用哪张图当封面”的个人偏好，与 Canonical 公共事实解耦；
- 多用户 / 多设备场景下不会互相覆盖彼此的封面选择；
- 不触碰 Shared Pack（社区资料只读），Private Library 之外的人看不到。

因此封面通过既有的 `PresentationPreference.preferredCoverAssetId` 指向一张新生成的 `poster` Asset，而不是直接写 `work.assetIds`。

## 依赖与降级

抽帧需要本机安装 `ffmpeg`（或一个可用的 `ffmpeg` 可执行文件路径）。项目不内置、也不强依赖 ffmpeg：

- 设置页新增 `ffmpegPath` 字段，留空时回退到 PATH 中的 `ffmpeg`，与既有的 `ffprobePath` 处理方式一致；
- 任意前置条件不满足时，抽帧接口返回**结构化失败原因**，前端友好提示，而不是抛 500：
  - `no-private-library`：尚未配置可写的 Private Library；
  - `no-media`：作品没有可读取的本地视频（未扫描到媒体文件，或文件已不在原路径）；
  - `ffmpeg-missing`：系统未检测到 ffmpeg（命令找不到，ENOENT）；
  - `extract-failed` / `media-unreadable`：抽帧命令失败或生成的图片无法读取。

> 没有 ffmpeg 时，按钮仍会显示并允许用户点击；点击后给出明确引导“请在设置页填写 ffmpeg 路径”。这样代码当下即可验证，装好 ffmpeg 即直接产出封面，无需改动业务代码。

## 数据模型与存储

- 抽出的帧以 `image/jpeg` 上传为 **`poster` 类型 Asset**，走既有的 `uploadPrivateAsset()` 内容寻址流程（SHA-256 去重、二进制与 JSON 分离）。
- 随后把偏好写回 `PresentationPreference`：
  - 写入根使用 `getPrivateRuntimeLibraryPath()`（已配置 Private Library 落到该库；未配置则回退 Git 忽略的 `data/library`，绝不碰只读 `data/demo-library`）；
  - 写入时**合并既有偏好**（收藏 / 评分 / 头像），只更新 `preferredCoverAssetId`，不会覆盖用户的其它私人设置；
  - `resolveWorkCoverAsset()` 已优先采用 `preferredCoverAssetId`，因此设置后作品卡片与详情页封面会立即采用新帧。

## 平台边界

抽帧与 ffprobe 一样归类为**平台能力**：

- `MediaFramePort` 接口定义在 `src/application/platform/platform-ports.ts`（不依赖任何 Node 内建模块）；
- `NodeFrameAdapter` 在 `src/infrastructure/platform/node-platform-adapters.ts` 用 `execFile` + 参数数组调用 ffmpeg（`windowsHide` 避免 Windows 黑框、30 秒超时由 `AbortSignal` 控制、绝不拼接 Shell 命令字符串）；
- `src/application/media/` 不属于 V1-12 冻结的“媒体扫描业务核心”，因此 `validate:platform` 边界校验不拦截；临时抽帧结果用 `node:fs` 读取符合该目录职责。

## 用户界面

- 作品详情页在“资产偏好工作台”之后新增「从视频抽帧生成封面」小节（仅当已配置 Private Library 且该作品存在本地媒体文件时出现）；
- `GenerateCoverButton` 客户端组件调用 `POST /api/works/[id]/cover-frame`，成功后 `router.refresh()` 让封面立即刷新，失败按原因展示提示。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/works/[id]/cover-frame` | 抽帧并设为封面；成功返回 `{ ok: true, assetId }`，失败返回 `{ ok: false, reason, message }`（HTTP 422） |

## 关键实现文件

| 文件 | 职责 |
|---|---|
| `src/domain/entities/instance-settings.ts` | `ffmpegPath?: string` 设置字段 |
| `schemas/instance-settings.schema.json` | 同步 `ffmpegPath` 字段 |
| `src/infrastructure/settings/instance-settings-store.ts` | 归一化 `ffmpegPath` |
| `src/application/settings/settings-service.ts` | 接收并保存 `ffmpegPath` |
| `src/components/settings-form.tsx` | 设置页 `ffmpegPath` 输入框 |
| `src/i18n/settings.ts` | 设置页三语文案 |
| `src/application/platform/platform-ports.ts` | `MediaFramePort` / `MediaFrameResult` 接口 |
| `src/infrastructure/platform/node-platform-adapters.ts` | `NodeFrameAdapter`（ffmpeg `execFile`） |
| `src/application/media/media-frame-service.ts` | `generateWorkCoverFrame()`：选可读视频 → 抽帧 → 上传 Asset → 合并偏好 |
| `src/app/api/works/[id]/cover-frame/route.ts` | 抽帧端点（nodejs runtime） |
| `src/components/generate-cover-button.tsx` | 详情页触发按钮（客户端） |
| `src/app/works/[id]/page.tsx` | 详情页接入按钮 |
| `src/i18n/ui.ts` / `src/app/globals.css` | 三语文案与样式 |
