# V1-25A Vocabulary Coverage & Source Mapping

## 目标

V1-25A 先于 Onboarding / Community Registry，解决“来源能抓到分类，但不同站名字、语言和语义桶不一致”的基础问题。

## 数据流

```text
Provider / NFO / scraper term
        ↓
结构字段 / 人物 / Maker / Series 排除
        ↓
classification-term-aliases
        ↓
┌────────────┬────────────┬─────────────┐
│ Genre      │ Work Type  │ Source-only │
└────────────┴────────────┴─────────────┘
        ↓
Canonical stable ID
        ↓
ja / zh-CN / en reviewed display
```

模糊或复合词不会自动写入：

```text
review-required
→ 保持 unmapped / audit-visible
→ 人工审核
```

## 数据规模

- Canonical Genre：320；
- Work Type：43；
- Source-only：38；
- Generic / legacy term mapping：150（140 approved + 10 review-required）；
- Community crosswalk：323 / 323；
- 旧版 33 个 Genre ID 和 8 个 Work Type ID 保持稳定。

## Coverage 工具

对任意 `key=value` 分类替换表运行：

```bash
pnpm vocabulary:coverage -- path/to/genre-substitutions.txt
```

JSON 输出：

```bash
pnpm vocabulary:coverage -- path/to/genre-substitutions.txt --json
```

报告区分：

- Genre；
- Work Type；
- Source-only；
- 安全多目标映射；
- Review Required；
- Unmapped。

本轮对用户提供的两份 MetaTube 参考表已做到 **0 Unmapped**；仍有少量复合桶明确保持 Review Required，因此不是虚假的“100% 自动落库”。

## Validator

`pnpm validate:vocabulary` 检查：

- Canonical ID 唯一与三语完整性；
- V1-24 历史稳定 ID 未被删除；
- Alias 规范化冲突；
- Alias / Crosswalk 目标存在；
- Community `genre_000001 ... genre_000323` 无缺号；
- JSON / CSV 行数镜像；
- Source-only 不污染 Genre / Work Type。

根 `pnpm check` 已包含此 Validator。
