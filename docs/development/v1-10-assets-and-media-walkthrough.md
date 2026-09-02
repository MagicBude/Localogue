# V1-10 教材：图片上传、内容寻址与本地媒体扫描

## 一、你会在这一版学到什么

这一版同时涉及 Web 文件上传、二进制存储、哈希、HTTP 资源响应、操作系统目录扫描和外部进程调用，是很典型的“网页开始接触本地系统能力”的阶段。

推荐阅读顺序：

1. `src/domain/entities/asset.ts`
2. `src/domain/entities/presentation-preference.ts`
3. `src/application/assets/asset-upload-service.ts`
4. `src/infrastructure/assets/asset-content-resolver.ts`
5. `src/components/asset-preference-workbench.tsx`
6. `src/domain/entities/media-file.ts`
7. `src/application/media/media-scan-service.ts`
8. `src/app/media/page.tsx`

## 二、浏览器上传文件发生了什么

```text
<input type=file>
   ↓
FormData
   ↓
POST /api/assets/upload
   ↓
ArrayBuffer / Uint8Array
   ↓
SHA-256
   ↓
asset-files/<hash>.jpg
   +
assets/<asset-id>.json
```

浏览器传的是二进制，不是“文件路径”。服务器不会相信用户原文件名作为真实存储路径。

## 三、为什么用 SHA-256 内容寻址

传统方式：

```text
portrait.jpg
portrait(1).jpg
新头像最终版2.jpg
```

很容易重复和冲突。

内容寻址：

```text
SHA-256(文件内容) → 固定文件名
```

相同内容自然得到相同路径。这和 Git、对象存储、缓存系统中的思想非常接近。

## 四、为什么 Asset JSON 和图片文件分开

JSON 适合：关系、来源、MIME、宽高、Hash。

二进制文件适合：图片本身。

如果把 Base64 图片塞进 JSON：

- Git Diff 很差；
- 文件巨大；
- 每次修改元数据都可能重写大块内容；
- 未来迁移 SQLite 也不方便。

因此 V1-10 使用“元数据 + 外部文件”的常见媒体库模式。

## 五、Next.js 如何返回本地图片

浏览器不能直接访问：

```text
D:\LocalogueLibrary\asset-files\...
```

所以页面使用：

```text
/api/assets/<id>/content
```

Route Handler 在服务器端解析 Asset 真正来自 Private Library 还是 Shared Pack，然后返回图片字节。

这就是一个很小的“受控文件服务接口”。

## 六、MediaFile 扫描

```text
/settings 配置目录
   ↓
/media 点击扫描
   ↓
fs.readdir 递归发现视频
   ↓
番号匹配 Work
   ↓
ffprobe
   ↓
MediaFile JSON
```

`ffprobe` 不是 npm 包，它是 FFmpeg 套件提供的命令行程序。Node.js 使用 `execFile()` 传入参数数组，而不是拼接 Shell 字符串，可减少命令注入风险。

## 七、为什么 SHA-256 默认关闭

图片通常较小，上传时计算 SHA-256 成本很低；视频可能几十 GB。

扫描 100 个 20 GB 文件并全部 Hash，意味着真正读取约 2 TB 数据。因此 V1-10 把视频 Hash 做成用户显式选项，而 ffprobe 元数据默认可启用。

## 八、为什么 V1 还是同步扫描

目前是个人本地工具，V1 先把模型和行为跑通。目录非常大时，HTTP 请求不适合一直挂着。

未来更成熟的结构应该是：

```text
POST 创建 Scan Job
   ↓
Background Worker
   ↓
进度 / 取消 / 重试
```

这会成为学习任务队列和后台 Worker 的自然入口。
