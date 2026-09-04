# Private Asset 文件存储

默认私人资料库结构：

```text
<Private Library>/
├── assets/
│   └── asset_xxx.json
├── asset-files/
│   └── <sha256>.jpg
└── presentation-preferences/
    └── presentation_person_xxx.json
```

## 写入与显示

- Asset JSON 进入 Local Asset Collection；二进制图片进入当前 Private Library 的 `asset-files/`。
- Presentation Preference 只属于私人层，不改写 Canonical / Shared Pack。
- Shared Pack 可以携带自己的只读 Asset JSON 与 `asset-files/`。Desktop 显示图片时由 Native 按当前 Repository 的 `Private > Shared Pack` 优先级解析稳定 `Asset.id`，并要求 Webview 提供的 `storagePath` 与最高优先级来源 Asset JSON 完全一致。
- 每个来源只能读取**自己的** `asset-files/`；禁止绝对路径、`..`、符号链接越界和任意文件读取。Shared Pack 没有任何图片写入或清理入口。
- Localogue 不会自动把用户上传图片发布到 Community Pack。

## 为什么删除 Asset JSON 后不立即删除二进制

content-addressed 文件可能被其它 Asset 记录复用，也可能处在恢复、迁移或异常中间态。因此删除 Asset 元数据时默认保留物理文件，不把“删除一条 JSON”直接等同于“删除磁盘图片”。

V1-24B 起 Desktop `媒体 → 资源文件健康` 可以检查当前 Private Library：

- **孤儿文件**：位于 `asset-files/` 中，但没有任何当前 Asset JSON 的 `storagePath` 引用；
- **缺失文件**：Asset JSON 指向 `asset-files/`，但对应普通文件不存在或不安全；
- **非托管引用**：Asset 使用 `asset-files/` 以外的路径，仅报告，不自动修改。

## 孤儿文件安全清理

“清理孤儿文件”只允许 Native 删除**当前 Private Library/asset-files** 内真正无引用的普通文件：

1. Native 在执行清理时重新读取最新 Asset JSON，不接受 Webview 提交删除路径列表；
2. 仅处理 `asset-files/` 内的普通文件，符号链接会被跳过；
3. 删除前再次 canonicalize，并确认真实目标仍位于 canonical `asset-files/` 根内；
4. Shared Pack、外部兼容路径、缺失 Asset 元数据都不会被自动删除或修改。

开发验收可使用：

```bash
pnpm desktop:demo:reset
pnpm desktop:demo:orphan
```

第二条命令只在 `var/dev-fixture-library/asset-files/` 制造一个没有 Asset JSON 引用的测试图片；它不会修改 Desktop Settings。
