# V1-16 Independent NFO Library Ingest 实现导读

## 这一版为什么先做 NFO，而不是继续复制 Web 页面

V1-15 已经让 Desktop 成为正式 Localogue 宿主，但真实本地资料库暴露了一个更基础的问题：媒体文件可以被扫描成 `MediaFile`，资料事实却可能已经存在另一棵 NFO 目录树中。

如果继续假设：

```text
video.mkv
video.nfo
```

Localogue 就会漏掉大量“视频与元数据分开管理”的已有资料库。

因此 V1-16 先冻结一个更可靠的模型：

```text
mediaScanPaths                 nfoScanPaths
      |                              |
      v                              v
MediaFile discovery           NFO metadata discovery
      |                              |
      |                        Preview / Explicit Import
      |                              |
      +----------- code ------------+
                  |
                  v
             Canonical Work
```

**目录位置不是关系主键，番号才是。**

## 一、为什么 `mediaScanPaths` 和 `nfoScanPaths` 必须分开

两个目录解决的问题不同：

- `mediaScanPaths`：这台机器拥有哪些视频文件？
- `nfoScanPaths`：用户已有的本地元数据告诉 Localogue 什么？

它们可以重叠，但不要求重叠。用户无需为了 Localogue 搬移或重命名原有资料。

## 二、NFO 如何得到番号

识别顺序故意保守：

1. XML 内 `num / number / code / productid` 等可验证字段；
2. XML 内 `id / uniqueid` 中真正符合番号模式的值；
3. 如果 XML 没有可验证番号，再从文件名识别。

这一步特别避免一个常见坑：Kodi 风格 NFO 可能同时带 TMDB 的纯数字 `id` 和其他 `uniqueid`。Localogue 不会因为先看到一个纯数字 ID 就阻止后续番号识别。

典型文件名：

```text
SONE-123.nfo
SONE-123 2026-08-01 片名.nfo
2026-08-01 SONE-123 片名.nfo
ABW001_20250812_片名.nfo
300MIUM-123 2025.01.02 片名.nfo
FC2-PPV-1234567 2025-01-02 title.nfo
```

`ABW001` 会规范化为 `ABW-001`。日期和片名只是 XML 缺失时的辅助信息，不取代番号主键。

## 三、为什么先 Preview，再 Import

递归扫描 NFO 是读操作。扫描完成后 Desktop 会显示：

- 新 Work；
- 已有 Work；
- 缺番号；
- 新 Work 缺标题；
- 同番号重复 NFO；
- 解析失败。

只有用户点击“导入可识别项目”之后才会写 Private Library。

同一番号出现多份 NFO 时，V1-16 只选一份候选：先比较元数据完整度，再比较文件修改时间。其余项目显示为“重复番号”，不会重复写 Work。

## 四、新 Work 与已有 Work 的策略为什么不同

### 新 Work

必须至少得到：

- 可靠番号；
- 标题（XML 或文件名 fallback）。

然后可以创建基础 Work，并对以下实体做规范化精确复用，不存在时创建 Private Entity：

- Person；
- Maker / Label；
- Series；
- Genre；
- Tag。

这里只做精确规范化匹配，不做模糊别名猜测。

### 已有 Work

采用 **fill / merge**：

- 标题已有：不覆盖；
- 日期已有：不覆盖；
- 时长已有：不覆盖；
- 简介已有：不覆盖；
- 人物 / Series / Genre / Tag：只合并不存在的关系；
- Maker / Label：只有原字段为空时才补。

因此 NFO 适合给空资料库打底，而不是用批处理压过后续人工治理结果。

## 五、为什么导入 NFO 后还要再跑一次媒体扫描

`Work` 与 `MediaFile` 仍然分离。

NFO 导入不会假设某个 NFO 对应旁边哪一个视频。导入完成后，已有增量媒体扫描重新计算番号绑定：

```text
MediaFile filename code
        ==
Canonical Work code
```

即使视频的 size / mtime 没变化，绑定关系仍会重新判断；没有变化的视频不会因此重新执行昂贵的 ffprobe 或完整 SHA-256。

## 六、Native Writer 为什么不能接收任意根目录

V1-16 为 NFO Bootstrap 增加了 Works / People 等 Canonical 写能力。如果 Rust Writer 接受 Webview 传入任意 `libraryPath`，理论上 Webview 就可能把 Shared Pack 路径当成写目标。

因此 V1-16 收紧为：

```text
Webview
  -> write_library_entity(collection, entity)
  -> Rust load_desktop_settings()
  -> configured Private Library
  -> whitelist collection
  -> minimal shape validation
  -> atomic JSON replace
```

Webview 不再选择写根目录。

写集合白名单：

```text
works / people / organizations / series / genres / tags / media-files
```

`assets` 仍不可写。

删除更加严格：V1-16 只有 `media-files` 可删除，Canonical Entity 删除必须等待后续治理流程。

## 七、这和 Evidence / Review 是否冲突

Localogue 的长期治理方向没有改变：外部资料应可追溯，冲突修改应经过 Evidence / Review / Commit Plan / History。

V1-16 的 NFO 导入被限定为一个**显式确认的 Bootstrap Ingest**，用于把用户已有本地资料迁入空 / 半空 Private Library：

- Preview 阶段不写；
- 用户明确点击才写；
- 已有核心事实不覆盖；
- 不开放 Canonical 删除；
- 不把这条捷径推广到在线 Provider 或普通编辑。

V1-17 会继续把 Desktop 的冲突修改、人工编辑和更广泛导入接回完整治理链。

## 八、本机验收流程

```bash
pnpm install
pnpm check
pnpm desktop:doctor
pnpm desktop:rust:check
pnpm desktop:dev
```

Desktop 内建议用真实资料库按下面顺序：

1. Settings 选择 Private Library；
2. 添加媒体扫描目录；
3. 添加一个或多个独立 NFO 元数据目录；
4. 保存；
5. Media -> “扫描 NFO”；
6. 检查预览中的番号、标题和状态；
7. 点击“导入可识别项目”；
8. 返回 Home / Works / People，确认计数和实体出现；
9. 再执行“媒体扫描”；
10. 检查原先未绑定的 MediaFile 是否按番号关联 Work；
11. 再扫描一次，确认 unchanged 视频不会重复做昂贵分析。

如果某些 NFO 显示“缺少番号”或“解析失败”，保留对应文件名和 NFO 中与番号相关的 XML 片段即可继续扩展兼容规则，而不需要先重整整个资料库。
