# Portable Pack（V1-11）

## 目标

V1-09 的 Shared Pack 是“目录挂载协议”，非常适合 Git clone；V1-11 再增加 `.localogue-pack`，解决离线转发、换电脑和一次性安装。

Portable Pack 是**传输容器**，不是新的 Canonical 数据模型。解包以后仍然回到原来的 JSON Library / Shared Pack 目录。

## 容器格式

V1-11 使用：

```text
.localogue-pack
  = gzip(
      UTF-8 JSON PortablePackEnvelope
    )
```

Envelope 中每个文件记录：

- 相对路径；
- `utf8` 或 `base64` 编码；
- 原始字节数；
- SHA-256。

选择 gzip JSON 是为了在 V1 不引入额外压缩依赖，同时把目录穿越、单文件 Hash 和版本检查做清楚。它不是永久承诺；未来可替换为流式 ZIP/TAR，但业务层仍使用同一个 Pack Manifest / Preview / Import Plan。

## 两种 Pack

### Personal Backup

用于自己的设备迁移。包含：

- Canonical JSON；
- Evidence / Lifecycle / Commit History / Provenance；
- Person Edit / Media Binding Receipt；
- Presentation Preference；
- Asset JSON 与 `asset-files/`。

故意不包含：

- `media-files/`：磁盘路径换电脑后通常失效；
- `.localogue/settings.json`：属于当前实例配置；
- 原始视频文件。

V1-11 导入只新增缺失文件；遇到同路径文件默认跳过，不覆盖。

### Shared Library Portable Archive

用于把已经通过 Community Validator 的 Shared Pack 做成单文件转发。安装时：

1. 解到临时目录；
2. 校验所有文件 SHA-256；
3. 执行 Community Data Validator；
4. 通过后 rename 到 `.localogue/packs/<pack>-<version>/`；
5. 自动追加到实例 `sharedPackPaths`。

## 安全边界

- 禁止绝对路径；
- 禁止 `..`；
- 同一路径不能重复；
- Shared Portable Pack 只接受 `localogue-pack.json`、`library/`、`sources/`；
- Personal Pack 只接受明确白名单目录；
- V1-11 单包暂限 256 MB，并在内存中解码；更大规模以后升级流式 Job。
