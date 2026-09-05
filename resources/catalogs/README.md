# Community Catalog Resources

这里保存 Localogue 已经人工审核、去重后的只读 Canonical 参考目录。

它和 `resources/registries/` 的职责不同：

- `resources/registries/` 保存“来源说了什么”，允许同一实体在多个 Provider 中重复出现；
- `resources/catalogs/` 保存“Localogue 最终把它认成什么”，同一实体只保留一个 Canonical ID。

当前文件：

- `community-organizations.{json,csv}`：Maker / Label Canonical Catalog；
- `community-series.{json,csv}`：Series Canonical Catalog。

## 运行时边界

Community Catalog 是全局只读参考索引，不属于某个用户的 Private Library，也不会自动挂载成 Shared Pack。

Desktop Browse 在“无作品 / 全部”模式下会把这里的 Maker / Label / Series 与当前 Library Profile 已加载的实体合并展示；“有作品”仍只由当前资料库真实 Work 关联计数决定。

因此 Community Catalog 中出现 `0 部作品` 是正常的：它表示 Localogue 已经认识这个实体，但当前 Profile 还没有作品引用它。

## Promotion 规则

Registry Evidence 只有满足人工审核后才能进入 Community Catalog：

1. 必须至少有一条 `verified` Evidence；
2. Provider ID 只在自己的 namespace 内有效；
3. 多个来源确认同一实体时，只生成一个 Canonical ID；
4. Label / Series parent 没有证据时不猜；
5. Promotion 后由 Registry Evidence 的 `canonicalId` 反向指向 Catalog 实体。

校验：

```bash
pnpm validate:catalog
```

## 多语言显示名

V1-27D 开始为 Community Catalog 的名称增加 `nameKinds` 语义，避免把社区翻译冒充来源官方名称：

- `source-name`：来源原名；
- `reviewed-brand-form`：审核后的品牌/拉丁字母写法；
- `community-translation`：社区审核翻译；
- `community-transliteration`：社区审核转写。

品牌没有可靠中文名时允许缺少 `zh-CN`，Desktop 会按既有本地化回退规则显示原名；不为了三语齐全而硬翻。描述性 Label / Series 可以逐步加入社区翻译。

## Browse 边界

Desktop Browse 继续负责“看完整目录”，不会增加 Maker → Label → Series 级联筛选。已确认 parent 只作为卡片上的归属提示展示；真正的 Maker / Label / Series / Genre 等组合条件应统一放在 Works 多维筛选中。
