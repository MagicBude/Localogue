# Localogue Dev Fixture Library

这是一套**完全虚构、可重置、可提交到 Git** 的 Desktop 开发测试资料库。

它解决的问题是：开发者本机即使没有任何真实 Private Library、封面、头像或 Gallery，也可以稳定复现 Presentation / Asset 相关功能，不再依赖私人资料。

## 核心原则

- `template/` 是只读测试模板，不建议直接在 Desktop 里选择它；
- `pnpm desktop:demo:seed` 会把模板复制到 `var/dev-fixture-library/`；
- `pnpm desktop:demo:reset` 会删除运行时副本并重新复制干净模板；
- `pnpm desktop:demo:clean` 只删除运行时副本；
- 脚本**不会修改** `.localogue/settings.json`，避免误切换真实 Private Library；
- `var/` 属于运行时目录并被 Git 忽略；
- 所有人物、作品、厂商、名称和图片内容均为虚构/生成式测试素材，不对应真实人物或真实发行作品。

## 快速使用

```bash
pnpm desktop:demo:reset
pnpm desktop:dev
```

然后在 Desktop：

```text
设置
→ 私人资料库
→ 选择目录
→ <仓库>/var/dev-fixture-library
→ 刷新资料
```

需要恢复到完全一致的初始状态时：

```bash
pnpm desktop:demo:reset
```

需要删除运行时副本：

```bash
pnpm desktop:demo:clean
```

Fixture 本身可独立校验：

```bash
pnpm validate:fixture
```

## 当前测试场景

`fixture-manifest.json` 保存稳定的 Scenario ID，后续手工验收和自动化测试都应优先复用这些 ID，而不是依赖列表顺序。

### LX-101 · 有效 Work Presentation Preference

- Canonical 默认海报：`asset_fixture_lx101_poster_summer`
- 私人首选海报：`asset_fixture_lx101_poster_midnight`
- 可测试：
  - 首选封面是否覆盖 Canonical 默认；
  - 恢复默认；
  - 首页 / Works / Work Detail 是否保持一致；
  - Preference 仍引用时删除首选 Asset 是否被 Native 拒绝；
  - 恢复默认后能否删除这个仅靠 subject 归属的备用 Asset。

### 水野あいこ · 有效 Person Presentation Preference

- Canonical 默认头像：`asset_fixture_aiko_portrait_primary`
- 私人首选头像：`asset_fixture_aiko_portrait_window`
- 另有一张 Gallery：`asset_fixture_aiko_gallery_cafe`
- 可测试人物卡、详情页、Presentation Workbench 与删除保护。

### LX-202 · 无显式 Preference

- Canonical 默认海报：`asset_fixture_lx202_poster_blue`
- 可选备用海报：`asset_fixture_lx202_poster_sea`
- 初始状态应使用 Canonical / 自动回退；可以手工设为备用海报再恢复默认。

### 立花りな · 无显式 Preference

- Canonical 默认头像：`asset_fixture_rina_portrait_primary`
- 可选备用头像：`asset_fixture_rina_portrait_pink`
- 另有一张 Gallery：`asset_fixture_rina_gallery_bookstore`

### LX-303 · 故意失效的 Preference

`presentation_fixture_work_lx_303_stale` 故意指向不存在的：

```text
asset_fixture_missing_cover
```

这是**预期测试数据，不是坏数据**。Desktop 应显示 stale / 失效偏好，并允许恢复默认；不得偷偷修改 Canonical。

## 图片素材

当前包含 10 张生成式 JPEG 测试图：

```text
asset-files/
├─ posters/
│  ├─ lx-101-poster-summer-echo.jpg
│  ├─ lx-101-poster-midnight-bloom.jpg
│  ├─ lx-202-poster-blue-morning.jpg
│  └─ lx-202-poster-sea-breeze.jpg
├─ portraits/
│  ├─ aiko-portrait-primary.jpg
│  ├─ aiko-portrait-window.jpg
│  ├─ rina-portrait-primary.jpg
│  └─ rina-portrait-pink.jpg
└─ gallery/
   ├─ aiko-gallery-cafe.jpg
   └─ rina-gallery-bookstore.jpg
```

Asset JSON 保存真实 `fileSize` 和 SHA-256；`pnpm validate:fixture` 会重新读取二进制并验证，防止测试图片被替换后 JSON 元数据悄悄过期。

## 后续扩展规则

新增依赖真实数据条件的功能时，优先给 Fixture 增加一个**最小、明确、可重置**的测试场景。例如：

- V1-24B：人物 Portrait / Gallery 上传、删除、孤儿 Asset；
- Portable Pack：冲突、跳过、覆盖预览；
- Media：可复用的小型合法测试媒体；
- Review：固定 Evidence / Commit / Snapshot 场景。

不要把真实私人资料复制到本目录。

## 与其他 examples 的联动

V1-24 起 `dev-library` 是整个 `examples/` 的主数据真相，而不是另起一套孤立 Demo：

- `../imports/sample-existing-work.json` 直接命中 `LX-101`，并故意把时长从 118 写成 121；
- `../settings/settings.example.json` 指向 `var/dev-fixture-library`，并挂载 Starter Shared Pack；
- `../shared-packs/starter-community-pack/` 包含与 Private 同 ID 的 `person_fixture_aiko_mizuno`，用于验证 Private > Shared；
- 原来的 `examples/people/` 与 `examples/works/` 已移除，Canonical JSON 结构示例直接复用本目录 `template/people` 与 `template/works`。

因此新增开发样例时应优先扩展本 Fixture，再让 imports / shared-pack / settings 引用它，而不是新建另一套互不相干的示例实体。
