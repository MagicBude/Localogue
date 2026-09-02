# local-javlibrary 对 Localogue 的参考价值

参考项目：`Achaiccccc/local-javlibrary`。

该项目是 Electron + Vue 3 的本地 NFO 影视库。Localogue 不复制其 GPL-3.0 实现代码，只研究公开架构与产品经验。

## 值得吸收

### 1. 增量扫描

项目后续版本专门重构数据同步逻辑，并报告约 3000 条数据时，增量扫描可从分钟级降到秒级。

Localogue V1-12 因此正式引入：

- 磁盘/现有状态差异比较；
- `size + mtime` 快速路径；
- unchanged 不重新 ffprobe / Hash；
- add / update / remove 分类。

### 2. 单例扫描任务

桌面应用不应该因为用户重复点击按钮同时启动多轮扫描。Localogue 新增 `MediaScanCoordinator`，并支持取消与进度。

### 3. NFO / 图片 / 视频伴随文件发现

其 NFO、poster、fanart 等同目录发现方式说明“媒体目录不只有视频”。Localogue 将这些文件保留为 Sidecar Observation，但不会像 NFO 浏览器那样直接写 Canonical。

### 4. 大数据量优化

该项目后续增加后端分页、懒加载、虚拟列表等优化，说明本地库进入数万条规模后，SQLite / Indexed Query 是必需能力。这支持 Localogue 的 V2 SQLite 路线。

### 5. Desktop Backend 与 UI 隔离

Electron Main / IPC / Vue UI 的边界说明桌面系统能力应该集中在后端 Adapter，而不是散落在组件中。Localogue 采用 Platform Ports，，V1-13 已接入 Tauri Desktop Alpha。

## 不照搬

### NFO 不是真相

Localogue：

```text
NFO → Evidence → Review → Canonical
```

而不是：

```text
NFO → Canonical DB
```

### 名字不等于人物身份

演员头像、别名可以用于候选匹配，但 Community Person 仍使用稳定 ID。

### 不直接复制 GPL 代码

参考设计和性能经验，不拷贝 scanner / sync 等具体实现。
