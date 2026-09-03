# V1-15 Desktop Feature Parity I 实现导读

## 这一版解决什么问题

V1-13 证明 Localogue 可以拥有安全的 Tauri Desktop Runtime，V1-14 又证明共享 `MediaScanCoordinator` 可以在 Desktop 真正运行。但此时 Desktop 仍更像“原生能力测试台”，用户的大部分资料浏览仍必须回到 Web。

V1-15 开始解决产品层问题：**让 Desktop 成为 Localogue 的正式第二宿主，同时不制造第二套业务规则。**

## 一、为什么不直接复制 Web 页面

Next.js 页面里同时存在：

- React 展示组件；
- URL 导航状态；
- Server Component / Route Handler；
- Node 文件系统 Repository；
- Web 专用表单与 API 调用。

把这些目录直接复制到 Vite/Tauri，不仅很多代码无法运行，还会把 Node/Next 平台细节带进 Webview。

V1-15 采用更稳定的拆法：

```text
Domain Entity / Query Type
          |
Application Query Core
       /          \
Json Repository  Tauri Repository
       |          |
Next.js UI     Desktop UI
```

平台可以不同，业务含义必须相同。

## 二、`library-query.ts` 为什么重要

过去 `JsonLibraryRepository` 自己包含 Works / People 的过滤与排序。Desktop 如果照抄，这些规则很快会漂移。

因此 V1-15 抽出：

```text
src/application/library/library-query.ts
```

它是纯函数模块：输入已经读取好的 Entity 数组和 `WorkQuery / PersonQuery`，输出分页结果与 Facet。

Web 与 Desktop 都调用它，所以：

- 番号/标题搜索一致；
- 人物所有姓名类型搜索一致；
- 年份/时长/关系过滤一致；
- self-excluding Facet 一致；
- 默认排序和分页一致。

这也是未来 V2 SQLite 的行为基线：SQLite 可以用 SQL 优化查询，但不能随意改变已经确定的 Query 语义。

## 三、`TauriLibraryRepository` 做什么

Desktop 新增：

```text
apps/desktop/src/platform/tauri-library-repository.ts
```

它实现既有 `LibraryRepository`，但底层不使用 Node `fs`，而是调用受限 `desktopBridge`。

读取时按顺序合并：

```text
Private Library
Shared Pack 1
Shared Pack 2
...
```

同一 ID 第一个实体胜出，因此 Private Override 语义与 Web 一样。

### 为什么 MediaFile 不跟着合并

MediaFile 保存的是本机路径、技术参数、Hash 与本地 Work 绑定，它属于 Private Layer。Shared Pack 的 Community Metadata 不应该携带另一台机器的媒体路径。

因此 Desktop `listMediaFiles()` 只读 `privateRoot`。

## 四、为什么 Shared Pack 要先经过 Rust 校验

设置里的 Shared Pack 路径来自用户选择。不能只因为目录中“好像有 library”就直接当作资料源。

Rust `inspect_shared_pack` 会检查 Manifest 和 `library/`，只有有效 Pack 才进入 Repository `readRoots`。

这带来两个好处：

1. UI 可以明确告诉用户哪个 Pack 无效、为什么无效；
2. Repository 不需要在每次查询时重复猜目录结构。

## 五、读白名单和写白名单为什么分开

V1-14 扫描只需要 Works + MediaFiles，所以 Rust 原生集合白名单很小。V1-15 为浏览页面需要读取 People、Organizations、Series、Genres、Tags、Assets。

但“能看”不代表“能改”。

因此 Rust 现在有两个边界：

```text
read whitelist:
works / people / organizations / series / genres / tags / assets / media-files

write whitelist:
media-files
```

Canonical 编辑要等 V1-16 把已有 Commit Plan、Audit、Evidence 治理规则正确接过来，而不是用通用 JSON 写命令绕过它们。

> 路线调整：实际 V1-16 因真实资料库需求，先实现独立 NFO Bootstrap Ingest；完整治理交互顺延到 V1-17。V1-16 Writer 也已收紧为 Rust 从 Desktop Settings 强制解析 Private 根，而不是 Webview 可指定任意写目录。

## 六、Desktop 页面现在有哪些

### Home

展示 Works / People / Makers / Series / Media 统计，以及最近作品和关联人物。

### Works / Work Detail

支持基础文本搜索、列表浏览和详情关系展示。

### People / Person Detail

支持姓名/别名搜索、人物状态、姓名历史、职业资料和相关作品。

### Media

继续运行 V1-14 增量扫描，同时显示 Private MediaFile、Work 绑定、技术参数，并支持打开/定位/单文件 Probe。

重要变化是：扫描与浏览共用 `TauriLibraryRepository`，所以 Shared Pack Work 也能参与番号匹配。

### Packs

显示 Private / Shared 数据源优先级和 Native Manifest 校验结果。

### Settings

管理 Private Library、Shared Pack 路径、媒体扫描目录、ffprobe 路径和本机 Web URL。

## 七、V1-15 还没有做什么

V1-15 是 **Feature Parity I**，重点是建立正式 Desktop 浏览骨架和共享业务边界，因此暂时没有：

- Web 那套完整高级筛选 UI；
- Canonical Work / Person 编辑；
- Evidence Inbox / Review / Curation / History；
- MediaFile 人工 bind / rebind / unbind 审计 UI；
- Portable Pack 完整导入导出；
- Asset 二进制封面/头像完整显示与 Presentation Preference；
- 安装器、签名、自动更新。

这些进入 V1-16 及后续阶段。

## 八、本机验收

覆盖 V1-15 后运行：

```bash
pnpm install
pnpm check
pnpm desktop:doctor
pnpm desktop:rust:check
pnpm desktop:dev
```

重点人工检查：

1. 设置 Private Library 后 Home / Works / People 能读取资料；
2. 添加合法 Shared Pack 后其 Works / People 能出现在 Desktop；
3. Private 与 Shared 存在相同 ID 时 Private 实体优先；
4. Works / People 搜索结果与 Web 基本一致；
5. Work / Person 详情关系可以互相跳转；
6. Media Scan 仍正常运行；
7. 只有 Shared Pack、没有 Private Library 时可以浏览，但扫描提示需要 Private Library；
8. 无效 Shared Pack 在 Packs / Settings 显示错误且不参与读取；
9. MP4 / MKV 单文件 Probe、打开和定位正常；
10. `pnpm validate:desktop` 继续确认 Canonical 写白名单只有 `media-files`。
