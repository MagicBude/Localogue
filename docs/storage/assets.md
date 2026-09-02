# 资源文件存储

## 原则

图片和视频二进制不直接塞进 JSON。

V1-10 把两个概念明确分开：

- `Asset`：图片、海报、头像等资源的元数据；
- `MediaFile`：用户本机的视频文件记录。

## Private Asset 目录

```text
<Private Library>/
├── assets/
│   └── asset_xxx.json
├── asset-files/
│   └── <sha256>.<ext>
└── presentation-preferences/
    └── presentation_person_xxx.json
```

用户上传图片时：

1. 计算 SHA-256；
2. 使用 Hash 作为二进制文件名；
3. 提取可识别的图片宽高；
4. 创建 Asset JSON；
5. 如果用户选择它作为头像/封面，再单独写 Presentation Preference。

## Shared Pack Asset

Shared Pack 可以携带只读 Asset JSON 和对应资源文件。`storagePath` 使用相对 Pack `library/` 根目录的安全路径。

Localogue 必须先确定 Asset 元数据来自哪个层，再解析文件路径，不能把 Shared Asset 错误拼接到 Private Library。

## 当前支持上传的图片

- JPEG
- PNG
- WebP
- GIF
- AVIF

用户上传 SVG 暂不支持；原因不是显示能力，而是未经清洗的 SVG 可能携带主动内容。

## MediaFile

视频文件不复制到 `asset-files/`。V1-10 只记录原始本地路径和 ffprobe / Hash 元数据，默认不移动、不重命名、不删除原始视频。
