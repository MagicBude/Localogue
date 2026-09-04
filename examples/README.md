# 示例与开发 Fixture

`examples/` 只保存**完全虚构、可以公开提交**的结构示例、导入样例和开发测试 Fixture；不允许放真实私人资料。

V1-24 起这里不再维护两套互相独立的“人物 / 作品示例”。原来的 `examples/people/` 与 `examples/works/` 已并入可运行的 `dev-library/template/`，避免文档示例、Desktop 手工测试与未来 E2E 使用不同数据而逐渐漂移。

## 目录职责

| 目录 | 用途 | 是否直接作为 Private Library 使用 |
| --- | --- | --- |
| `dev-library/` | 标准可重置 Private Library Fixture；Work / Person / Asset / Presentation 的主测试真相 | 不直接写模板；先 `pnpm desktop:demo:reset` |
| `imports/` | JSON / NFO / CSV / XLSX 导入样例；其中“已有作品”样例直接引用 Dev Fixture 的 `LX-101` | 否 |
| `shared-packs/` | 只读 Shared Pack 示例；与 Dev Fixture 配合测试 Private > Shared | 否，作为 Shared Pack 挂载 |
| `settings/` | Web Instance Settings 与 Desktop Library Profile 配置示例 | 否 |

原来的 `people/`、`works/` 独立示例目录不再保留。需要查看 Canonical Work / Person JSON 时，直接阅读：

```text
examples/dev-library/template/works/work_fixture_lx_101.json
examples/dev-library/template/people/person_fixture_aiko_mizuno.json
```

这样同一份 JSON 既是文档结构示例，也是 Desktop 可实际读取、可被 Validator 校验、未来可被 E2E 复用的 Fixture。

`settings/` 内刻意分成两份：

```text
settings.example.json          # 遵循 Web / Instance Settings Schema
desktop-settings.example.json  # Desktop Bootstrap Settings + Library Profile
```

不要把 Desktop-only 的 Profile 字段塞回 `settings.example.json`，否则会破坏 `schemas/instance-settings.schema.json` 的严格 `additionalProperties=false` 契约。

## 快速开始

```bash
pnpm desktop:demo:reset
pnpm desktop:dev
```

然后在 Desktop：

```text
设置 → 私人资料库
→ <仓库>/var/dev-fixture-library
→ 刷新资料
```

如果还要验证 Private > Shared：

```text
资料包 → 挂载 Shared Pack
→ <仓库>/examples/shared-packs/starter-community-pack
```

此时 `person_fixture_aiko_mizuno` 同时存在于 Private 和 Shared；界面必须使用 Private 记录 `水野あいこ`，而不是 Shared 记录 `水野あいこ・共有版`。

## 导入 / Review 联动

`imports/sample-existing-work.json` 不再依赖旧的 `DEMO-001`。它直接指向 Dev Fixture 中已存在的：

```text
LX-101
```

Fixture Canonical 时长为 `118` 分钟，Evidence 样例故意写成 `121` 分钟，因此可以稳定复现：

```text
导入
→ Evidence
→ 匹配已有 Work
→ durationMinutes 字段差异
→ Review / Commit Plan
```

`imports/sample-work.json` 以及 NFO / CSV / XLSX 样例则继续使用同一套 `LX-*` 虚构人物、厂商、系列和词表，但使用不存在的新番号，用于观察“新作品候选”和实体解析。

## 相关命令

```bash
pnpm validate:fixture
pnpm desktop:demo:seed
pnpm desktop:demo:reset
pnpm desktop:demo:clean
```

完整 Fixture 场景见 `dev-library/README.md`。
