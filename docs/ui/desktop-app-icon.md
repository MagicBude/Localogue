# Desktop 应用图标

Localogue 的应用图标使用“影像画框 + 资料卡盒 + 定位书签”组合，分别表达本地媒体、结构化目录和可定位的私人资料。图标不依赖字母，因此在非拉丁语言界面和 32px 小尺寸下仍能靠轮廓识别。

## 文件职责

- `apps/desktop/src-tauri/icons/icon-source-v2.png`：高分辨率设计源图，用于以后重新生成平台图标；
- `32x32.png`、`128x128.png`、`128x128@2x.png`：桌面和开发环境 PNG；
- `icon.ico`：Windows 可执行文件与安装器；
- `icon.icns`：macOS 应用包。

平台文件统一由 Tauri CLI 从同一源图生成，避免手工缩放造成各尺寸内容、透明边缘或颜色不一致：

```powershell
pnpm --filter @localogue/desktop tauri icon src-tauri/icons/icon-source-v2.png
```

源图由内置 ImageGen 生成，最终提示词要求无文字、无字母、紫蓝底与珊瑚暖色强调，并保证小尺寸轮廓清楚。
