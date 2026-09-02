# V1-09 教材：设置页与分层资料库

## 1. 为什么以前要写 `.env.local`

以前路径解析只有：

```text
process.env.LOCALOGUE_LIBRARY_PATH
```

因此必须在仓库根目录 `.env.local` 写：

```text
LOCALOGUE_LIBRARY_PATH=./data/library
```

环境变量很适合 Docker、服务器和 CI，但普通桌面用户不应该为了改资料目录去编辑隐藏配置文件。

## 2. V1-09 新增实例设置文件

```text
.localogue/settings.json
```

它被 Git 忽略，只属于当前机器。

浏览器 `/settings`：

```text
SettingsForm
  ↓ PUT /api/settings
SettingsService
  ↓
InstanceSettingsStore
  ↓
.localogue/settings.json
```

## 3. 为什么环境变量仍然优先

优先级：

```text
LOCALOGUE_LIBRARY_PATH
        >
Web Settings libraryPath
```

服务器管理员通过环境变量指定挂载卷时，网页不能偷偷把它改到另一个目录。

这是一种典型的 **Configuration Precedence**。

## 4. 为什么 Repository 不能在启动时把路径固定死

V1-08：

```ts
new JsonLibraryRepository(getReadableLibraryPath())
```

只在模块第一次加载时解析路径。

用户在网页保存新路径后，这个 Repository 仍握着旧路径。

V1-09 改成传入函数：

```ts
new JsonLibraryRepository(
  getReadableLibraryRoots,
  getConfiguredPrivateLibraryPath,
)
```

每次真正读写时才取得当前路径。

这叫 **late binding / 延迟绑定**。

## 5. 多根读取

`JsonFileStore` 现在可以读取多个根：

```text
root A / people
root B / people
root C / people
```

用稳定 `id` 合并：

```text
A 中已有 person_001
B 中也有 person_001
→ A 胜出
```

这就是 Local Override 的基础。

## 6. 为什么写入只能去私人根

Shared Pack 是只读数据源。

所以读取和写入路径被明确拆开：

```text
readRoots:
  private + shared packs

writeRoot:
  private only
```

如果没有私人 Library，Repository 的 `savePerson()` / `saveWork()` 必须失败，而不是顺手写进 Shared Pack。

## 7. CLI 为什么也要懂 Web Settings

如果网页读取：

```text
D:\Library
```

而 `pnpm validate:data` 仍检查 Demo，检查结果就没有意义。

因此独立脚本新增：

```text
scripts/lib/runtime-settings.mjs
```

保证网页与 CLI 使用同一套路径优先级。

## 8. 浏览器为什么没有直接“选择任意本地文件夹”的按钮

普通 Web 页面受到浏览器沙箱限制，不能像桌面原生程序一样直接获得任意系统目录的真实绝对路径并让服务器长期访问。

Localogue 当前是本地 Next.js Server，因此 V1-09 采用：

- 文本输入绝对/相对路径；
- 服务端负责解析和访问；
- 未来如果包装为 Electron/Tauri，可再提供原生文件夹选择器。
