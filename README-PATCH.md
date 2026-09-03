# V1-22 Hotfix 2 覆盖包说明

覆盖当前 V1-22 / V1-22 Hotfix 后运行：

```bash
pnpm install
pnpm check
pnpm desktop:rust:check
pnpm desktop:dev
```

本 Hotfix 不改资料库与扫描链，只修 Desktop Presentation：

1. Work Detail Gallery 会根据当前图片真实宽高比自动选择纵向 / 横向 / 方形 Stage；
2. poster / cover 为纵向图片时会获得更高的展示区域，继续完整显示，不通过 `cover` 裁切；
3. fanart / screenshot 等横向图片继续使用横向大画布；
4. 切换 Asset 后 Gallery 会根据新图片宽高比调整展示高度；
5. Desktop 主内容区取消固定最大宽度，全屏或 2K / 4K 窗口会真正使用右侧空间；
6. Works Table / 海报墙 / 列表 / Facet、People、Browse 与详情页都会随窗口一起扩展；
7. 阅读型简介等长文本仍保留自身阅读宽度，不会为了“铺满屏幕”变成超长单行；
8. 顶栏版本信息从 Runtime 读取，不再显示历史硬编码 `V1-20`。

重点验收：

- 打开一部拥有纵向 poster 的作品，poster 应完整且明显地展示，而不是缩在横向画布中央；
- 左右切换 poster / fanart / thumb 时 Gallery 应根据实际方向改变高度；
- Desktop 全屏后 Works 页面右侧不应再出现由固定 `1460px` 内容宽度产生的大块空白；
- 将 Sidebar 收起后，释放出的宽度应直接进入主内容区和结果区。

产品版本继续保持 `0.1.22`。
