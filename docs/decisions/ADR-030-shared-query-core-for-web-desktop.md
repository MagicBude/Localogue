# ADR-030：Web 与 Desktop 共享 Library Query Core

## 状态

已接受，V1-15。

## 背景

Localogue 已同时存在 Next.js Web 与 Tauri Desktop 两个宿主。它们读取资料的方式不同：Web 通过 Node 文件系统和 `JsonLibraryRepository`，Desktop 通过受限 Tauri/Rust Commands。

如果 Desktop 为了尽快做出 Works / People 页面而复制一份过滤、排序、分页和 Facet 逻辑，会产生两个长期问题：

1. 同一查询在 Web 与 Desktop 得到不同结果；
2. 每新增一个筛选维度都必须修改两套实现并重复测试。

直接让 Desktop 调用 Next.js Route Handler 也不合适，因为 Desktop 应具备离线本地运行能力，并且 Node 文件 API 不应成为 Tauri Webview 的隐式依赖。

## 决策

将不依赖平台的 Library 查询规则抽到：

```text
src/application/library/library-query.ts
```

它负责：

- Works 文本与关系过滤；
- 年份、日期、时长、本地媒体、封面过滤；
- Work 排序、分页和 self-excluding Facet；
- People 姓名、状态、年份、身高过滤；
- Person 排序和分页。

Web `JsonLibraryRepository` 和 Desktop `TauriLibraryRepository` 各自负责“怎样把实体读进内存”，然后调用同一个 Query Core。

Desktop 的存储适配仍遵守：

```text
Private Library > Shared Packs
```

且 `media-files` 只来自 Private Library。

## 后果

### 好处

- Web / Desktop 查询语义天然一致；
- Query Core 可以脱离 React、Node、Tauri 单独测试；
- 后续迁移到 SQLite 时，可以把 Repository 查询实现替换为 SQL，同时保留当前 Domain Query 语义作为行为基线；
- Desktop 不需要依赖 Next.js Server 才能浏览本地资料。

### 代价

- V1 JSON Repository 仍需要先把集合读入内存，超大资料库性能最终仍要靠 V2 SQLite；
- UI 层仍可能因为展示能力不同而存在差异，Query Core 只解决业务查询语义，不强制两端 JSX 完全相同。

## 约束

- Query Core 不得依赖 `node:*`、Tauri 或 React；
- 新增 Work / Person 查询规则时必须优先修改共享 Query Core；
- 不允许为了 Desktop 临时需求另写一套同义过滤器；
- Desktop Canonical 写入仍必须遵守治理边界，本 ADR 不授权扩大 Rust 写权限。
