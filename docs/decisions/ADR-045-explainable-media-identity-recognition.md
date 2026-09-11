# ADR-045：媒体身份采用可解释识别快照

## 状态

已接受。

## 背景

原扫描器能让 `ABC-123-CD1`、`CD2` 命中同一 Work，却没有表达分段序号、版本线索或文件名与 NFO 番号冲突。用户看到的是“已绑定”，无法判断绑定依据，也无法可靠区分 CD10 与 CD2。

## 决策

在 MediaFile 增加可重算的 `recognition` 快照，由共享 Application Service 生成：

1. 文件名番号与 NFO 番号作为独立证据保存；
2. 显式分段保存数字 `part.index`，展示时使用自然顺序；
3. 版本、辅助媒体和上下篇等线索进入 `needs_review`；
4. 两种番号冲突进入 `identity_conflict`，禁止自动 Work 绑定；
5. 无番号文件继续作为合法的未识别 MediaFile 保存；
6. 人工绑定是用户已经作出的治理决定，后续扫描继续保留。

统一同步可以把已经解析的 NFO Preview 作为只读提示传给媒体扫描。独立视频扫描无法读取 NFO 内容时只报告文件名证据，不猜测不存在的 NFO 结论。

## 结果

分段与版本不再制造多个 Work，冲突不会被静默覆盖。规则仍然位于平台无关 Application Core，Web、Desktop 和未来 SQLite Adapter 可以复用。识别快照不修改 Canonical，也不扩大 Tauri 文件权限。
