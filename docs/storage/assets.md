# 资源文件存储

## 原则

图片和视频不直接塞进 JSON。

## V1 建议目录

```text
data/assets/
├── works/
│   └── ABC-123/
│       ├── cover.jpg
│       ├── poster.jpg
│       └── screenshots/
└── people/
    └── person_example_001/
        ├── portrait.jpg
        └── gallery/
```

## 模式

V1 主要支持：

- 资料库内托管的 Asset；
- 外部路径引用的 MediaFile。

后续再考虑硬链接、软链接和 Managed Library。
