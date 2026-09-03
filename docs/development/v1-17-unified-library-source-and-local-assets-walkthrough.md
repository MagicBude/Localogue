# V1-17 Unified Library Source 与本地图片 Asset 实现导读

## 一、这一版解决的真实问题

V1-16 已经允许 NFO 和视频使用不同目录，但真实资料库经常不是“两个完全独立目录”，而是一棵有组织的大目录：

```text
收藏根目录/
├─ 单体/                # 视频
├─ VR/                  # 视频
├─ 封面+元数据/         # NFO + poster + fanart + thumb
├─ 字幕/
└─ 写真/                # 视频分类目录
```

用户不应该为了 Localogue 重建目录结构，也不应该反复把这些子目录逐个添加到设置。

V1-17 因此把扫描入口提升成 `libraryRoots`：添加共同父目录一次，后续扫描按文件类型分流。

## 二、三类路径为什么同时保留

```text
libraryRoots    首选：统一资料源根目录
mediaScanPaths  高级：额外媒体-only 路径
nfoScanPaths    高级：额外 metadata/image 路径
```

这不是三套互相竞争的模式：

- 普通资料库只配置 `libraryRoots`；
- 视频和 NFO 真正在不同磁盘时，可以继续补 `mediaScanPaths / nfoScanPaths`；
- 目录重叠时按规范化绝对文件路径去重，不重复导入同一个文件。

Web 与 Desktop 对 `libraryRoots` 使用同一设置语义；Web Media Scan 也会把它并入媒体扫描根目录。

## 三、媒体、NFO 和图片如何跨子目录汇聚

Localogue 不用“同目录”建立业务关系，而用 Work Code：

```text
单体/MIDE-974.mp4
       -> MIDE-974

封面+元数据/2021-10-01 MIDE-974 标题.nfo
       -> MIDE-974

封面+元数据/2021-10-01 MIDE-974 标题-poster.jpg
       -> MIDE-974 + poster

封面+元数据/2021-10-01 MIDE-974 标题-fanart.jpg
       -> MIDE-974 + fanart

封面+元数据/2021-10-01 MIDE-974 标题-thumb.jpg
       -> MIDE-974 + screenshot

                   ↓
               Work MIDE-974
```

图片优先从自身文件名识别番号。如果图片本身没有可验证番号，还可以和已扫描 NFO 的规范化 stem 对照；两者都不能可靠命中时就跳过，不做模糊猜测。

## 四、为什么不自动吃掉目录里的所有 JPG

统一根目录里可能还有大量与作品封面无关的图片，例如：

- 截图；
- 无关图片；
- 用户自己整理的素材。

因此 V1-17 自动导入只接受明确角色后缀：

```text
-poster
-cover
-fanart / -background / -backdrop
-thumb / -thumbnail / -screenshot
```

这里的“写真”可以是视频作品分类目录，目录名本身没有任何扫描语义：其中的 MP4 / MKV 仍按视频处理。图片是否成为 Work Asset 只由图片文件自身的扩展名、角色后缀和番号匹配决定。Desktop 的媒体扫描不再把 JPG/PNG 纳入视频发现队列，图片改走专门 Asset 链。

## 五、本地 Asset 为什么要复制进 Private Library

Asset JSON 不应该长期依赖一个可能被用户移动、删除、改名的外部文件路径。

Native 导入流程：

```text
original.jpg
  -> extension + size + magic-byte validation
  -> SHA-256
  -> Private Library/asset-files/<sha>.jpg
  -> Asset JSON
  -> Work.assetIds
```

原文件只读，不移动、不删除。

SHA-256 让相同内容只需要一份 Private 二进制；Asset 自己仍有独立 ID 和 Work 关系。

## 六、为什么 NFO 要先导，图片后导

用户可以面对一个完全空的 Private Library。

同一次“导入元数据与图片”操作里，Desktop 会：

1. 先导入 NFO，创建 / 补充 Work；
2. 再按番号重新查询 Work；
3. 把 poster / fanart / thumb 挂到刚创建的 Work。

因此不用“先导一次 NFO、关掉页面、再单独导图片”。

## 七、多段 NFO 如何展示

像：

```text
MDVR-195.part1.nfo
MDVR-195.part2.nfo
...
MDVR-195.part6.nfo
```

现在预览显示成一个 `MDVR-195` Work Group，并在组内列出 6 个来源。Canonical Bootstrap 仍只使用质量最高的一份代表，不会创建 6 个 Work。

## 八、安全边界

V1-17 新增 Asset Native Import，但不开放通用文件写入：

- source 只允许 JPEG / PNG / WebP / GIF / AVIF；
- 最大 25 MB；
- Rust 检查 magic bytes，拒绝“只改扩展名”的伪图片；
- destination 只能是当前 Desktop Settings 的 Private Library；
- Shared Pack 不可写；
- Canonical 删除仍未开放，只有 `media-files` 可删除。

## 九、本机验收建议

```bash
pnpm install
pnpm check
pnpm desktop:doctor
pnpm desktop:rust:check
pnpm desktop:dev
```

Desktop 中建议：

1. Settings 配好 Private Library；
2. 在“统一资料源根目录”只添加你的共同父目录，例如 `.../石川澪 DMM原档合集`；
3. 旧的高级媒体/NFO路径可以先保留，扫描器会去重；确认稳定后也可以移除冗余项；
4. 进入“本地资料”点击“扫描资料源”；
5. 核对 NFO Work Group 与 Local Asset Candidates；
6. 确认 `poster / fanart / screenshot` 类型、番号和状态正确；
7. 点击“导入元数据与图片”；
8. 打开 Work 详情，确认“本地图片”计数和 Asset 列表；
9. 再运行媒体扫描，让视频按番号汇聚到相同 Work。

如果有你明确希望支持但被标为 `unknown asset type` 的命名规则，保留文件名样例即可继续扩充，不需要移动原始文件。
