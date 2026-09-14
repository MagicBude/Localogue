# ADR-042：首次使用只选择内容目录

## 背景

Private Library、Unified Root 和 Library Profile 是必要的内部概念，但要求新用户在看到作品前理解三者会增加首次使用成本。用户真正知道的信息通常只有“影片放在哪个目录”。

## 决策

空白 Desktop 的主入口只要求选择一次影片资料目录。Native Runtime 固定在 App Local Data 的 `user-library/` 创建 Private Library，React 随后建立名为“我的资料库”的默认 Profile，并把用户选择的目录保存为 Unified Library Root。

设置页继续保留完整 Profile、独立扫描路径和 Shared Pack 管理，供迁移、NAS 和多资料库场景使用。

## 为什么由 Native 创建 Private Library

WebView 可以提交用户通过目录选择器取得的内容根目录，但不能提交任意 Canonical 写入根。`provision_private_library` 不接收目标路径，只能创建固定的 App Local Data 子目录，因此简化操作没有扩大文件写权限。

首次设置按钮明确写为“选择目录并开始扫描”。用户点击后会创建目录配置并立即进入“导入与整理”，由同一可观察、可取消的 Unified Sync 依次处理 NFO、图片与媒体。它是用户显式发起的一次组合操作，不是后台静默导入。
