# Desktop 应用图标

Localogue 的应用图标使用一条胶片构成字母 `L`，并在横向胶片中嵌入播放切口。`L` 直接关联产品名称，胶片和播放符号表达本地媒体；单一轮廓也比多对象组合更适合 24px～32px 小尺寸。

## 文件职责

- `apps/desktop/src-tauri/icons/icon-source-v3.png`：高分辨率设计源图，用于以后重新生成平台图标；
- `apps/desktop/src/assets/localogue-icon.png`：WebView 侧栏使用的同源图标，避免再次写死另一套品牌图形；
- `32x32.png`、`128x128.png`、`128x128@2x.png`：桌面和开发环境 PNG；
- `icon.ico`：Windows 可执行文件与安装器；
- `icon.icns`：macOS 应用包。

平台文件统一由 Tauri CLI 从同一源图生成，避免手工缩放造成各尺寸内容、透明边缘或颜色不一致：

```powershell
pnpm --filter @localogue/desktop tauri icon src-tauri/icons/icon-source-v3.png
```

源图由内置 ImageGen 生成，最终提示词要求用连续胶片构成几何 `L`，只保留一个播放切口，采用靛蓝、奶油白与珊瑚色，并保证小尺寸轮廓清楚。
