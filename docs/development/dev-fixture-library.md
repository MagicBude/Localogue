# Dev Fixture Library：没有真实资料也能稳定开发

Localogue 是 Local-First 应用，很多 Desktop 功能只有在“有作品、有多张图片、有私人 Preference”时才能真正验收。如果每次都依赖开发者自己的真实 Library，测试就会变得不可复现，也很难自动化。

V1-24 因此维护 `examples/dev-library/`：一套完全虚构、可提交、可重置的标准 Fixture。

## Examples 现在是一套联动测试体系

早期 `examples/` 同时存在独立的 `people/`、`works/`、`imports/`、`settings/`、`shared-packs/`。它们最初各自用于解释某一阶段功能，但随着 Desktop 能力增加，会产生一个问题：文档 JSON、导入样例、Shared Pack 与手工测试数据彼此没有关系。

V1-24 起统一为：

```text
examples/
├─ dev-library/      # Private / Canonical / Asset / Presentation 的主 Fixture
├─ imports/          # 与主 Fixture 联动的导入输入
├─ shared-packs/     # 与主 Fixture联动的只读 Shared Fixture
└─ settings/         # 指向上述 Fixture 的实例设置示例
```

原 `examples/people/` 与 `examples/works/` 已并入 `dev-library/template/people` 与 `dev-library/template/works`。因此 Canonical JSON 结构示例不再有第二份副本。

## Fixture 同时是产品展示库

V1-24 Foundation Cleanup 把早期 `data/demo-library` 中关系丰富的虚构 Canonical 记录合并进 Desktop Dev Fixture（不复制旧的文字型 SVG Asset）。运行副本现在包含 11 部作品、8 位人物以及多组组织、系列和分类关系；29 张生成式 JPEG 让每部作品至少有一张海报、每位人物至少有一张头像，同时继续保留多封面、多头像、Gallery 与 stale Preference 等专项场景。

因此 Fixture 有两种互补数据：

- `LX-*`：重点测试多封面、多头像、Gallery、Presentation / Asset；
- `DEMO-*`：关系和筛选更丰富，重点测试 Catalog / Facet / 详情关系，同时也拥有生成式海报与人物头像，不再依赖灰色占位卡。

这套资料未来也可以作为新用户第一次启动 Localogue 时的“示例库”。正式安装包应把模板作为应用资源，并复制到可写 App Local Data 后再使用，不能直接修改安装目录中的模板。

## Source Template 与 Runtime Copy

```text
examples/dev-library/template/
          │
          │ pnpm desktop:demo:seed / reset
          ▼
var/dev-fixture-library/
```

`template/` 属于 Git 中的测试真相；`var/dev-fixture-library/` 是 Desktop 可以自由写入的运行副本。

为什么不直接让 Desktop 使用 `examples/dev-library/template/`？因为 Presentation Preference、Asset 管理、Canonical CRUD 等操作都会写 Private Library。直接写模板会让一次手工测试产生 Git 工作区修改，甚至污染下一次测试。

## 三个命令

```bash
pnpm desktop:demo:seed
```

目标不存在时创建运行副本；已存在则保留当前状态，避免误覆盖正在调试的数据。

```bash
pnpm desktop:demo:reset
```

删除运行副本后重新从模板复制。需要复现 Bug、重新走验收步骤时优先使用它。

```bash
pnpm desktop:demo:clean
```

删除 `var/dev-fixture-library/`，不碰模板，也不碰用户设置。

## 为什么脚本不自动修改 Settings

自动把 Desktop 的 Private Library 改成 Fixture 看似方便，但可能把用户正在使用的真实 Library 静默切走。因此脚本只创建目录并输出绝对路径，由用户显式在 Desktop 设置页选择。

这是 Localogue 的一条开发安全边界：**测试工具可以准备数据，但不能偷偷改变真实实例指向。**

配套设置示例分成两份：

```text
examples/settings/settings.example.json
  # Web / Instance Settings Schema 兼容示例

examples/settings/desktop-settings.example.json
  # Desktop Bootstrap Settings + “示例库” Library Profile
```

两者都指向 `./var/dev-fixture-library` 与 Starter Shared Pack。之所以分开，是因为 Desktop Profile 属于本机桌面运行配置，不应污染 Web `instance-settings.schema.json`。脚本仍不会自动应用任何一份设置。

## Shared Pack 联动

`examples/shared-packs/starter-community-pack/` 是 Dev Fixture 的配套只读来源。

它特意包含与 Private Fixture 相同稳定 ID 的：

```text
person_fixture_aiko_mizuno
```

Shared 层 primary 名称是：

```text
水野あいこ・共有版
```

Private 层 primary 名称是：

```text
水野あいこ
```

同时挂载 Private Fixture 与 Starter Shared Pack 后，Localogue 必须显示 Private 版本。这是可复现的 `Private > Shared` 优先级验收场景。

## Import / Review 联动

`examples/imports/sample-existing-work.json` 直接引用 Fixture 中的 `LX-101`：

```text
Fixture durationMinutes = 118
Evidence durationMinutes = 121
```

因此它不再依赖旧 Demo Library，任何干净开发环境只要执行 `desktop:demo:reset` 就能稳定复现已有 Work 的字段差异。

其他 JSON / NFO / CSV / XLSX 样例也统一使用 `LX-*` 虚构世界中的人物、Maker、Label、Series 与 Vocabulary，但编号保持为新 Work，用于测试新作品候选与实体解析。

## Fixture Manifest

`examples/dev-library/fixture-manifest.json` 不参与产品运行，它给手工验收和未来 E2E 提供稳定 Scenario ID，并记录配套 imports / settings / shared-pack 路径。

测试代码不要写“列表第一部作品”，而应写：

```text
work_fixture_lx_101
person_fixture_aiko_mizuno
asset_fixture_lx101_poster_midnight
```

这样 UI 排序或新增 Fixture 后，测试意图仍然稳定。

## 图片为什么提交到仓库

只提交 JSON 而不提交二进制图片，无法真正覆盖：

- Native `asset-files/` 读取安全边界；
- JPEG 文件签名；
- Blob URL 显示；
- portrait / poster 的尺寸适配；
- 多 Asset Presentation Picker；
- Asset 删除引用保护。

因此 V1-24 Fixture 使用生成式模型制作完全虚构图片，再压缩为开发用 JPEG。它们不是占位色块，也不依赖公网 URL，离线即可测试。

## Fixture Validator

```bash
pnpm validate:fixture
```

会检查：

- JSON 是否可解析、ID 是否唯一；
- Work / Person / Organization / Series / Genre / Tag / Asset 引用；
- Asset `storagePath` 是否仍被限制在 `asset-files/`；
- 图片是否真实存在、是否为 JPEG；
- `fileSize` 和 SHA-256 是否与二进制一致；
- 有效 Preference、默认回退和 stale Preference 场景是否仍存在；
- `sample-existing-work.json` 是否仍能命中 Fixture Work 且保留一个明确字段差异；
- Settings 示例是否仍指向标准 Fixture 与 Starter Shared Pack；
- Shared Pack 是否仍包含和 Private 同 ID 的优先级测试记录；
- 旧的 `examples/people/` / `examples/works/` 是否被重新创建。

`pnpm check` 会执行这个校验，因此未来重构 Domain Model 时，Fixture 与整个 `examples/` 测试体系也必须一起演进。
