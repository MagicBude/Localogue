# Organization & Series Registry

## 目标

Localogue Community Data 优先建设数量相对有限的 Maker、Label、Series Registry。
这个仓库保存经过人工审核、可复核的静态资料；它不是 Provider 抓取器，也不承担在线采集。

## 实体关系

```text
Maker
  └─ Label
       └─ Series
```

- Label 的 `parentOrganizationId` 只能指向 Maker。
- Series 的 `parentOrganizationId` 可以指向最具体、且有证据支持的 Label 或 Maker。
- 没有足够证据时保持空值，不根据名称相似度自动猜测关系。

## Evidence 与 Canonical 的边界

Provider Evidence 只回答“某来源公开出现过什么名称/ID”。
它不会因为名称相似就直接变成 Canonical Maker / Label / Series，也不会跨 Provider 复用 ID。

Evidence 状态：

- `verified`：当前来源内的 ID/name 配对有可复核证据。
- `name-only`：只确认名称出现，不声称存在稳定 Provider ID。

## V1-27B 静态覆盖

本轮继续使用公开页面、厂商官网、已有真实样本以及外部资料整理静态 Evidence：

- FANZA：公开目录 URL 中可复核的 Maker / Label ID/name 切片；
- JAVBus：影片详情中的 Maker / Label 稳定 ID/name；
- JAVLibrary：Maker / Label 名称证据；
- S1 / IDEAPOCKET / MOODYZ / Madonna 官方站：Series 页面中的站内 Series ID/name。

注意：

1. “已验证切片”不等于“Provider 全量目录”。
2. 官方 Maker 站自己的 Series ID 只属于该站 namespace，不能当作 FANZA/JAVBus/JAVDB 的 Series ID。
3. Localogue 不集成这些站点的抓取/API 客户端；新增资料通过人工整理或外部工具获取后审核进入 Registry。

## 覆盖报告

```bash
pnpm registry:coverage
```

报告只统计仓库内已经审核保存的静态 Evidence，不进行联网，不访问任何 Provider。

## 校验

```bash
pnpm validate:registry
pnpm registry:audit
```

`validate:registry` 负责 Registry JSON/CSV 一致性、Provider ID 身份和 Evidence 状态；
`registry:audit` 默认检查 Community Catalog 的 Maker → Label → Series 结构关系，并报告缺少 parent 的 Label / Series。需要检查某个具体 JSON Library 时使用 `pnpm registry:audit -- --library <path>`。

## 后续数据建设顺序

1. 继续补主流 Maker 的公开名称、别名与来源证据；
2. 补每个 Maker 下可公开确认的 Label；
3. 以厂商官网 Series 页面和公开数据库交叉补 Series；
4. 对同名/改名/历史名称进行人工 Alias 合并；
5. 有充分证据后再建立 Canonical parent 关系。

整个过程遵循“先有限集合，再逐步扩无限作品”的资料库建设原则。

## V1-27C：从 Evidence 晋升 Community Catalog

V1-27C 增加 `resources/catalogs/`，把“来源证据”与“Canonical 参考实体”正式拆开：

```text
Registry Evidence
   │ 人工审核、去重、确认身份
   ▼
Community Catalog
   │
   └─ Desktop Browse 只读参考
```

晋升要求：

1. Community Catalog Entity 至少有一条 `verified` Registry Evidence；
2. 多个 Provider 的 Evidence 可以共同指向同一个 `canonicalId`；
3. `canonicalId` 的 kind 必须与 Evidence 的 `entityKind` 一致；
4. Label parent 必须是已确认 Maker；
5. 本轮晋升的 Series 必须拥有已确认 parentOrganizationId；
6. name-only / 身份不确定的 Evidence 不自动晋升。

Community Catalog 不属于任何 Library Profile，也不会改变 Private Library 或自动挂载 Shared Pack。Desktop 的“有作品”仍严格以当前 Profile 的 Work 关系计算；“无作品 / 全部”才补充 Catalog 参考实体。

完整概念说明见 `docs/catalog/library-profile-registry-community-catalog.md`。
