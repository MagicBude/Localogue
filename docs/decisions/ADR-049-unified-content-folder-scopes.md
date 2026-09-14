# ADR-049：用带扫描范围的内容目录取代三组重叠路径

- 状态：Accepted
- 日期：2026-09-14

## 背景

Desktop 先后引入 `mediaScanPaths`、`nfoScanPaths` 和 `libraryRoots`。三者解决了不同时期的问题，但同一路径经常需要在多组字段中重复表达，设置页、Profile 快照和扫描编排都要负责合并与去重。

## 决策

用户与应用层统一使用 `contentFolders`：

```ts
interface DesktopContentFolder {
  path: string;
  scanVideo: boolean;
  scanNfo: boolean;
  scanImages: boolean;
}
```

每个目录只保存一次，通过三个布尔值决定发现范围。普通新增目录默认全部启用；视频、NFO 或图片位于独立磁盘时，关闭无关范围即可。

旧 `libraryRoots / mediaScanPaths / nfoScanPaths` 在迁移期继续序列化为兼容镜像，使旧 Desktop Runtime 与旧设置可以安全回退。读取旧设置时按路径合并范围，读取新设置时以 `contentFolders` 为准。后续在所有受支持发行版都理解新字段后，再升级 Settings Schema 并删除旧镜像。

目录位置仍然不是 Work、MediaFile、NFO 或 Asset 的关系主键；实体继续使用规范化番号和既有保守匹配规则关联。

## 后果

- 设置只有一个“内容目录”列表；
- 单个路径不会因为媒体和元数据分工而重复显示；
- 扫描器按类型取得有效根目录，不改变 NFO → 图片 → 视频的编排；
- 迁移期磁盘 JSON 暂时同时含新结构和旧镜像，这是明确的兼容负担，不是长期模型。
