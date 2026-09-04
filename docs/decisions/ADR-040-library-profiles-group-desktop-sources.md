# ADR-040：用 Library Profile 组织 Desktop 本机资料源

- 状态：Accepted
- 日期：2026-09-04

## 背景

Desktop 逐步加入 Private Library、Unified Library Roots、Shared Packs、额外媒体目录、额外 NFO / 图片目录后，如果继续把它们全部视为独立的全局设置，会出现两个问题：

1. 普通用户很难理解哪些目录是“写入目标”、哪些是“扫描来源”、哪些是“只读公共层”；
2. 用户拥有影视、成人、示例等多个相互独立的收藏时，需要反复手工改多组路径，容易把媒体扫描结果或私人元数据写进错误的库。

## 决策

新增 Desktop `Library Profile`：它是本机路径设置的整组预设，不是新的 Domain 实体，也不进入 Canonical / Community Pack。

Profile 保存：

```text
Private Library
Content / Unified Roots
Extra Media Roots
Extra NFO / Image Roots
Shared Pack Paths
```

`ffprobePath`、Web URL、语言与主题继续保持应用级设置。

Desktop Settings 继续使用 `schemaVersion: 1`，通过可选 `libraryProfiles` 与 `activeLibraryProfileId` 做向后兼容扩展；旧用户无需迁移即可启动。

## 切换语义

切换 Profile 时整组应用其路径，然后由 Rust Settings Writer 原子保存。Repository 随保存后的 Private / Shared Roots 重建。

Profile 不复制文件、不移动媒体、不跨库同步 Canonical 数据。

## 为什么不使用多个配置文件 / 多进程实例

多个配置文件会把 Runtime、Shared Pack、扫描设置和 UI 状态的管理复杂度扩散到应用启动层，而且用户无法在运行中安全切换。

Profile 让“多个收藏”成为应用内显式概念，同时保持现有 Repository 与路径边界不变。

## 为什么 Community Data 不合并进主仓库

Community Data 是共享事实层，更新频率、贡献流程、许可边界和发布周期都与应用代码不同。它继续作为独立 Shared Pack 更符合 `Private > Shared` 架构，也避免主程序安装包随公共数据增长而膨胀。

主程序未来可以提供官方 Community Pack Registry / 一键安装与更新体验，但这属于“消费独立数据仓库”，不是把数据仓库并入代码仓库。

## 后果

优点：

- 可以快速切换示例库和任意用户自建资料库收藏；
- 每套扫描路径和 Shared Pack 不再混在一起；
- 设置页可以按“Profile → 四种资料源”解释；
- 不改变 Canonical Schema 或 Shared Pack 协议。

代价：

- Desktop Settings 多一层本机状态；
- 保存当前路径时必须同步回 active Profile；
- 侧边栏快速切换必须处理未保存设置草稿。
