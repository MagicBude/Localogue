# V1-18 Hotfix 2 Manifest — Windows Volume Scan Compatibility

## 触发症状

第一版栈溢出 Hotfix 在部分 Windows 卷、虚拟盘、网络/挂载卷上执行“同步资料库”或“仅扫描视频”时，扫描在枚举文件前失败：

```text
资料源扫描失败：无法解析资料扫描根路径：此卷不包含可识别的文件系统。
(os error 1005)
```

## 根因

Hotfix 1 为了建立 canonical visited 集合，把 `std::fs::canonicalize(root)` 作为扫描前置条件。Windows 某些卷可以正常执行 `metadata/read_dir`，但底层 `GetFinalPathNameByHandle` 无法返回 canonical path，于是 `canonicalize` 报 OS 1005。

这不等于资料卷损坏，也不应该阻止 Localogue 扫描。

## 修复

- 扫描根不再强制 `fs::canonicalize`；
- 绝对路径采用词法规范化，实际可读性由 `metadata + read_dir` 判断；
- `read_dir(root)` 成功即可进入扫描；
- visited 使用词法绝对路径 key，Windows 下仅用于扫描期去重并按大小写不敏感处理；
- symlink 继续不跟随；
- Windows 只禁止 reparse **目录**继续下钻，普通 reparse 文件仍允许进入扩展名筛选；
- junction/reparse 目录防环、`VecDeque` 迭代扫描、`spawn_blocking` 与目录数量上限继续保留；
- 根目录不可枚举时返回包含实际根路径的明确错误；子目录不可读仍记录并跳过。

## 不变项

- 产品版本保持 `0.1.18`；
- Unified Root、NFO → Asset → Media 同步顺序不变；
- Work / Asset / MediaFile Schema 不变；
- Private Asset Reader 的安全读取边界不因本 Hotfix 放宽；
- Shared Pack 继续只读。

## 本机验收

```bash
pnpm check
pnpm desktop:rust:check
pnpm desktop:dev
```

先点击“仅扫描视频”验证原扫描根可读，再点击“同步资料库”。终端应出现：

```text
[Localogue Desktop] walk_files start root=...
[Localogue Desktop] walk_files completed root=... files=... dirs=...
```
