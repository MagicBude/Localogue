# ADR-041：作品画廊完整显示所有视觉资源

## 状态

Accepted — V1-27 后续维护

## 背景

V1-22 为避免竖版海报占据过高首屏，曾把 poster 和大多数竖版 cover 排除在作品详情画廊之外。这个限制让画廊无法完成更基础的任务：用户进入作品详情后看不到完整封面，只能到首图偏好或 Asset 管理区域间接确认图片。

实现还出现了进一步漂移：教材描述画廊会按图片真实比例切换 portrait / square / landscape，但组件长期固定使用 landscape Stage。

## 决策

- 作品画廊展示属于当前 Work 的 `poster / cover / gallery / fanart / screenshot` 图片；
- 主舞台提供一个脱离 Grid 固有尺寸计算的绝对定位图像框，图像框与舞台同宽高，再由 `object-fit: contain` 在这个确定区域内保持图片比例并完整缩放；不得让图片固有最小尺寸撑出舞台后再裁切；
- 优先使用 Asset 中保存的宽高判断布局，并在图片实际加载后用 `naturalWidth / naturalHeight` 修正；
- portrait、square、landscape 使用不同舞台高度，但不会因为方向不适合宽屏而隐藏合法资源；
- 海报墙与 Presentation Preference 仍可继续把 poster 作为默认首图，这不改变 Canonical 数据或 Shared Pack。

## 结果

作品详情可以直接浏览完整封面和横版图，旧 Asset 缺少宽高时也能在加载后得到正确布局。画廊只改变 Presentation，不扩大 Native 文件读取权限。
