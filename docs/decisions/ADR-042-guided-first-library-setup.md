# ADR-042：首次使用只选择内容目录

## 背景

Private Library、Unified Root 和 Library Profile 是必要的内部概念，但要求新用户在看到作品前理解三者会增加首次使用成本。用户真正知道的信息通常只有“影片放在哪个目录”。

## 决策

空白 Desktop 的主入口只要求选择一次影片资料目录。Native Runtime 固定在 App Local Data 的 `user-library/` 创建 Private Library，React 随后建立名为“我的资料库”的默认 Profile，并把用户选择的目录保存为 Unified Library Root。

设置页继续保留完整 Profile、独立扫描路径和 Shared Pack 管理，供迁移、NAS 和多资料库场景使用。

## 为什么由 Native 创建 Private Library

WebView 可以提交用户通过目录选择器取得的内容根目录，但不能提交任意 Canonical 写入根。`provision_private_library` 不接收目标路径，只能创建固定的 App Local Data 子目录，因此简化操作没有扩大文件写权限。

首次设置只准备目录与配置，不在后台静默导入。用户仍通过首页“一键同步”明确启动 NFO、图片与媒体处理，以保持本地文件操作可观察、可取消。
