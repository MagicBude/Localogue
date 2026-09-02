# V1-12 教材：从“能扫描”到“平台无关的增量扫描”

这一版很适合学习三个软件工程概念：**Ports & Adapters、Incremental Computation、Background Job State**。

## 1. 为什么 `fs` 不应该出现在 MediaScanService

V1-10：

```ts
import { readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
```

业务层自己决定“怎么读磁盘”。

V1-12：

```ts
scanMediaLibrary(repository, request, platform)
```

业务层只知道：

```ts
platform.fileSystem.walkFiles(...)
platform.mediaProbe.probe(...)
platform.fileHash.sha256File(...)
```

Node、Tauri 只是不同实现。

## 2. Adapter 是什么

`NodeFileSystemAdapter` 把抽象操作翻译成 Node：

```text
FileSystemPort.walkFiles
→ fs.readdir / fs.stat
```

未来：

```text
FileSystemPort.walkFiles
→ Tauri command / Rust walkdir
```

业务规则不变。

## 3. 为什么不用 SHA-256 判断每次变化

Hash 很准确，但读取 30 GB 视频也必须读取 30 GB。

增量扫描先用廉价信息：

```text
size
mtime
```

只有文件真的变化，或用户明确要求 Hash，才做昂贵工作。

这叫“Fast Path”。

## 4. Sidecar 为什么是独立状态

视频可能几年都没变化，但 NFO / 海报今天刚生成。

因此：

```text
Video Fingerprint
≠
Sidecar Snapshot
```

二者独立比较。

## 5. 为什么扫描 Job 不等于 HTTP 请求

全量扫描可能持续很久。

错误模型：

```text
POST /scan
等待十分钟
返回 JSON
```

V1-12：

```text
POST /scan → 202 + job
GET /scan  → progress
DELETE     → cancel
```

目前 Job 存在本地 Next.js 进程内；以后 Tauri 可以把它放到 Rust Task。

## 6. 为什么 manual 绑定不能被 scanner 覆盖

自动算法是一种建议，用户明确绑定是治理决策。

所以：

```text
manual > code auto-match
```

这是“Human Decision Overrides Automation”的典型规则。

## 7. 推荐阅读顺序

1. `src/application/platform/platform-ports.ts`
2. `src/infrastructure/platform/node-platform-adapters.ts`
3. `src/application/media/media-scan-service.ts`
4. `src/application/media/media-scan-coordinator.ts`
5. `src/infrastructure/media/media-scan-runtime.ts`
6. `src/components/media-scan-workbench.tsx`
7. `docs/architecture/incremental-media-scan.md`
