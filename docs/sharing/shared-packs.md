# Localogue Shared Pack

## 定位

Shared Pack 是**只读、可分发的基础资料包**。

它不是：

- 用户私人 Library；
- Evidence；
- Git 仓库代码；
- 自动覆盖本地资料的更新器。

## V1-09 目录格式

```text
my-community-pack/
├── localogue-pack.json
└── library/
    ├── works/
    ├── people/
    ├── organizations/
    ├── series/
    ├── genres/
    ├── tags/
    └── assets/
```

其中 `localogue-pack.json`：

```json
{
  "schemaVersion": 1,
  "kind": "shared-library",
  "id": "localogue.community.jp",
  "name": "Localogue Community JP",
  "version": "2026.09.0",
  "languages": ["ja", "zh-CN", "en"],
  "license": "请填写真实许可"
}
```

## 挂载

在 `/settings` 中每行填写一个 Pack 根目录。

Pack 顺序就是读取优先级：

```text
Private Library
Pack A
Pack B
Pack C
```

同一稳定 ID 首次出现即胜出。

## 为什么 V1-09 先用“目录挂载”，还不是 zip 导入

先把“数据层语义”做正确，再做压缩格式。

目录形式具备：

- 可以直接查看 JSON；
- 适合 Git clone；
- 容易 Diff；
- 容易调试优先级；
- 不需要先引入 ZIP 解包安全问题。

后续可在这个协议之上增加：

```text
.localogue-pack
    ↓ 解包/校验
Shared Pack Directory
```

## Shared Pack 不应包含什么

社区 Pack 默认不应包含：

- 用户评分；
- 私人 Tag；
- 观看记录；
- 本地绝对文件路径；
- Evidence Inbox；
- Review Commit History；
- `.localogue/settings.json`；
- 无明确再分发授权的图片或长篇描述文本。

## 稳定实体 ID

Shared Pack 的覆盖语义依赖跨设备稳定 ID。具体原则见 [社区资料的稳定实体 ID](stable-community-ids.md)。

在身份规则未冻结之前，Localogue 不建议把一次性按姓名生成的 ID 当成长期社区 ID 发布。

## V1-11 Portable Archive

目录挂载仍是 Shared Pack 的原生运行形态；`.localogue-pack` 只是离线传输容器。

正式 Community Shared Pack 可以在 `/packs` 经过 Community Validator 后导出单文件；另一台 Localogue 先临时解包和校验，再安装到 `.localogue/packs/` 并自动加入 `sharedPackPaths`。

详见 [Portable Pack](portable-packs.md) 与 [Community Data 主项目对接](community-data-integration.md)。
