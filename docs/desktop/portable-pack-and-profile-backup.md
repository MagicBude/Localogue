# Desktop Portable Pack：按当前资料库备份与安全导入

V1-24C 将 Desktop 的 `.localogue-pack` 明确为**当前 Library Profile 的资料内容迁移工具**，而不是整个 Localogue 实例设置的镜像。

## Personal Backup 备份什么

点击“导出当前资料库备份”时，Desktop 只从当前 Profile 的 Private Library 收集：

- Canonical：works / people / organizations / series / genres / tags；
- Asset 元数据与 Private `asset-files/`；
- Presentation Preference；
- Evidence / Review / Snapshot / Restore / Provenance 等 Audit 数据；
- Person Edit / Media Binding Receipt 等私人治理记录。

不会包含：

- 视频等用户媒体文件；
- Library Profile 的本机路径；
- ffprobe / Web URL / UI 语言等实例设置；
- 当前挂载的 Shared Pack 内容。

这样从“示例库”切到另一个资料库以后，导出的 Personal Backup 只对应**当前 Private Library**，不会把其它 Profile 的路径配置混进备份。

## 导入前为什么先预览

Personal Backup 导入前会先将 Pack 中每个文件与当前 Private Library 比较，并分类为：

- **新增**：目标不存在，可以安全导入；
- **完全相同**：内容 SHA-256 相同，导入时跳过；
- **内容冲突**：目标已存在但内容不同，V1-24C 默认跳过，不覆盖本地文件。

预览同时按 Canonical、Asset 元数据、Asset 文件、Presentation、Audit 分类统计，并检查 Asset JSON 与 `asset-files/` 的引用/摘要完整性。

### 导入预览绑定当前资料库

在多 Library Profile 场景下，Import Plan 会记录**生成预览时的 Private Library 路径**。如果用户在预览后从侧栏切换到其它资料库：

- Webview 会立即禁用“确认导入”；
- Native Import 还会再次核对当前 Private Library 与预览目标；
- 两者不一致时拒绝写入，并要求重新选择 Portable Pack 生成新预览。

因此“在 A 库预览、切到 B 库后误点确认”不会把备份写入 B 库。

## Presentation / Asset 迁移规则

- Presentation Preference 仍然只是 Private 显示偏好，不升级成 Canonical 事实；
- Pack 内 Asset JSON 引用了 Private `asset-files/...` 时，备份应同时包含对应二进制；
- Asset JSON 声明的 SHA-256 与 Pack 中二进制摘要不一致时，预览直接阻止导入；
- Preference 指向 Pack 外 Asset 时会明确警告：导入后只有目标资料库已存在该 Asset 才能继续解析；
- 导入完成后 Desktop 会重新检查 Private Asset Storage Health，并报告缺失文件。

## 安全边界

- Personal Import 仍采用白名单目录；
- Webview 不能指定任意落盘位置；Native 根据当前 Profile 的 Private Library 决定写入根；
- Import Plan 与生成预览时的 Private Library 绑定；真正写入前 Native 再次核对目标，Profile 切换后旧预览自动失效；
- 既有文件永不被 Personal Import 静默覆盖；
- 写入路径下如果存在 symlink / Windows Reparse Point，Native 拒绝继续，避免目录重定向越过 Private Library；
- 中途失败会回滚本轮新建文件；
- Shared Pack 安装仍先写临时目录、完成 manifest/id/version 校验后再原子 rename，且挂载后保持只读。

## 示例库与 Shared Pack

“添加示例库”会同时在 App Local Data provision：

1. 可写的 Example Private Library；
2. 只读的 Starter Shared Pack。

因此标准示例 Profile 应显示 `Private + 1 Shared`。只有内置“示例库”自动挂这个 Starter Pack；普通“资料库 1 / 资料库 2 …”默认仍是 `Private + 0 Shared`。
