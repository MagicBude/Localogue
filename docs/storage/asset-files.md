# Private Asset 文件存储

默认私人资料库结构：

```text
<Private Library>/
├── assets/
│   └── asset_xxx.json
├── asset-files/
│   └── <sha256>.jpg
└── presentation-preferences/
    └── presentation_person_xxx.json
```

规则：

- Asset JSON 进入 Canonical/Local Asset Collection；
- 二进制图片进入 `asset-files/`；
- Presentation Preference 只属于私人层；
- Shared Pack 可以提供自己的只读 Asset 和资源文件；
- Localogue 不自动把用户上传图片发布到 Community Pack。
