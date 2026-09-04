# Localogue Current Manifest

## 阶段名称

**V1-24A：Desktop Presentation Preference Workbench**

当前版本（`0.1.24`）开始把 V1-10 已存在的 `presentation-preferences` 私人展示层真正接入 Desktop。目标不是把“我喜欢哪张图”写进 Canonical，而是让 Work / Person 在 Desktop 中可以独立选择首选封面与首选头像，并让首页、作品浏览、人物浏览与详情页遵循同一套解析规则。

## 本阶段完成

### Private Presentation Preference

- Desktop 增加专用 Native Presentation Reader / Writer；
- Presentation 写根只从当前 Desktop Settings 的 Private Library 解析；
- `presentation-preferences` 不进入 Shared Pack 写路径，也不混入 Canonical Writable Collection；
- Work 支持 `preferredCoverAssetId`；
- Person 支持 `preferredPortraitAssetId`；
- 清除偏好后恢复 Canonical / Subject Asset 自动回退；
- Preference 指向不存在或不再属于当前实体的 Asset 时标记为 stale，而不是偷偷换写 Canonical。

### Desktop Curation Workbench

- Curation 增加“完整度 / 重复”与“展示偏好”两个子视图；
- Presentation Workbench 可在 Works / People 之间切换；
- 可搜索作品番号/标题或人物姓名/别名；
- 集中显示已设置偏好、失效偏好与当前实际首图；
- 可直接切换首选 Asset 或恢复默认；
- 可从 Workbench 直接打开对应 Work / Person。

### Work / Person Detail

- Work Detail 新增“首选封面”私人展示选择器；
- Person Detail 新增“首选头像”私人展示选择器；
- 候选图只允许当前实体真正可使用的 Asset：
  - Work：`poster / cover`；
  - Person：`portrait / gallery`；
- 详情页明确显示“私人偏好 / 默认显示 / 失效偏好”；
- 恢复默认不会修改 Canonical 或 Shared Pack。

### Browse Presentation Parity

- 首页最近作品使用 Work Presentation Preference；
- 首页人物头像使用 Person Presentation Preference；
- Works 海报墙 / 列表使用首选封面；
- People 卡片使用首选头像；
- 人物相关作品列表也复用同一 Presentation 解析逻辑。

### Native Safety

- Asset 若仍被 `presentation-preferences` 引用，Native 删除会拒绝执行；
- 用户必须先恢复默认展示，再删除对应 Private Asset；
- Presentation Preference 使用独立 Native Commands，不借用通用 Canonical 写入，也不伪装成 Audit Collection；
- Shared Pack 继续保持只读。

### Dev Fixture Foundation

- 新增 `examples/dev-library/template/` 完全虚构 Private Library 模板；
- 包含 3 Work、2 Person、2 Organization、1 Series、3 Genre、3 Tag、10 Asset 与 3 Presentation Preference；
- 10 张生成式 JPEG 覆盖 portrait / gallery / poster，Asset JSON 保存真实 fileSize / SHA-256；
- `fixture-manifest.json` 固定有效 Work Preference、有效 Person Preference、默认回退、stale Preference、删除保护等测试场景；
- 新增 `desktop:demo:seed / reset / clean`，只操作 Git 忽略的 `var/dev-fixture-library/`；
- Fixture 管理脚本不自动改 `.localogue/settings.json`，避免测试工具静默切换真实资料库；
- 新增 `validate:fixture` 并纳入 `pnpm check`。
- 早期顶层 `examples/people` / `examples/works` 结构样例合并进 Dev Fixture，避免 Canonical 示例双份维护；
- `examples/imports/sample-existing-work.json` 直接命中 Fixture `LX-101`，形成可重复的 Import → Evidence → Review 差异链；
- `examples/settings` 与 `examples/shared-packs` 作为 Dev Fixture 配套示例联动维护；
- Starter Shared Pack 提供一个与 Private 同 ID 但显示名不同的人物记录，专门验证 `Private > Shared`；
- Fixture Validator 同时守护 imports / settings / shared-pack 契约与 examples 目录拓扑。

## 安全不变量

1. Presentation Preference 是私人显示选择，不是公共事实。
2. Shared Pack 永远只读。
3. Canonical `Work.assetIds / Person.portraitAssetId / galleryAssetIds` 不因为私人选图被改写。
4. Native Presentation Writer 只能写当前配置的 Private Library。
5. Asset 删除必须保护 Presentation Preference 引用。
6. V1-23 Governance / Snapshot / Portable Pack 与 V1-18 Native I/O 安全边界保持不变。

## 明确留到 V1-24B / V1-24C

- 人物 portrait / gallery 的完整上传与管理工作流；
- Asset 二进制物理清理与 orphan 检测；
- Shared Asset 的更完整来源可视化；
- Personal Pack 导入 Presentation 冲突的更细粒度报告；
- Presentation DTO / Service 在 Web 与 Desktop 间进一步共享。

## 版本

`0.1.24`
