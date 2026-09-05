# Library Profile、Registry Evidence 与 Community Catalog

这几个概念处在不同层次，容易混在一起。最简单的理解方式如下：

```text
公开网页 / 厂商官网 / 外部资料
              │
              ▼
       Registry Evidence
      “来源具体说了什么”
              │ 人工审核 / 去重 / 合并
              ▼
       Community Catalog
      “Localogue 认为什么”
              │
              ├──── Desktop Browse 的只读参考索引
              │
              └──── 未来可发布为 Shared Pack

Library Profile
  ├─ Private Library       可写，属于用户
  ├─ Shared Pack(s)        只读，属于当前 Profile
  ├─ 内容 / 媒体 / NFO 路径
  └─ 其他资料源配置
```

## Library Profile 是什么

Library Profile 是 Desktop 的“资料库配置档”。它回答的是：

> 我现在打开的是哪一套个人资料库？

一个 Profile 保存自己的 Private Library、内容根目录、额外媒体/NFO/图片目录和 Shared Pack 挂载。切换 Profile 只切换这些配置，不复制也不移动资料。

例如：

```text
示例库
  Private: var/dev-fixture-library
  Shared:  starter-community-pack

资料库 1
  Private: D:/Media/Localogue
  Shared:  某个社区包
```

所以 Library Profile 属于“用户运行时资料源”这一层。

## resources/registries 是什么

这是 Git 仓库里的维护目录，不是用户桌面版里的一个资料库。

它保存来源证据，例如：

```text
Provider: fanza
Kind: maker
sourceId: 3152
Name: エスワン ナンバーワンスタイル
```

或者：

```text
Provider: s1-official
Kind: series
sourceId: 414
Name: 新人NO.1STYLE
```

这些记录只表示“这个来源公开出现过这个 ID/name 配对”。它们还不是最终 Canonical Entity。

## Registry Evidence 是什么

Registry Evidence 就是 `resources/registries/` 中的一条来源事实。

同一个现实实体可以有多条 Evidence：

```text
FANZA        maker 3152  エスワン ナンバーワンスタイル
JAVBus       maker 7q    エスワン ナンバーワンスタイル
JAVLibrary   maker -     S1 NO.1 STYLE
S1 官网       maker -     エスワン ナンバーワンスタイル
```

这些不能被当成 4 个 Maker。经过人工审核后，它们可以共同映射到：

```text
maker_s1
```

Evidence 的作用是保留“为什么我们这样认定”的证据链。

## Community Catalog 是什么

Community Catalog 是 Registry Evidence 经过人工审核、去重后的 Canonical 参考目录。

例如：

```text
maker_s1
  ja: エスワン ナンバーワンスタイル
  en: S1 NO.1 STYLE
  aliases: S1
```

然后多条 Registry Evidence 的 `canonicalId` 都指向 `maker_s1`。

V1-27C 开始把这层真正落地到：

```text
resources/catalogs/
```

它和 Genre 的受控词表很像：即使当前 Library Profile 没有任何作品使用某个 Maker，Localogue 仍然可以知道“这个 Maker 已经在社区目录中”。

## Community Catalog 和 Shared Pack 有什么区别

两者都可以是只读社区资料，但用途不同：

- Community Catalog：仓库内的 Canonical 参考目录，主要用于“我们已经认识哪些实体”；
- Shared Pack：Desktop 可以实际挂载的运行时资料包，可以包含 Work、Person、Organization、Series、Asset 等完整 Canonical Entity。

V1-27C 先让 Desktop Browse 能直接看 Community Catalog，不会偷偷修改 Library Profile，也不会自动把它挂载成 Shared Pack。

以后如果需要让这些 Maker / Label / Series 参与更完整的实体详情、跨设备分发或 Work 引用，可以再把审核后的 Catalog 发布为正式 Shared Pack。

## Browse 中“有作品 / 无作品 / 全部”的含义

从 V1-27C 开始：

- **有作品**：当前 Library Profile 中至少有一部 Work 使用该实体；
- **无作品**：当前没有 Work 使用，但实体可能来自当前 Library 或 Community Catalog；
- **全部**：当前 Library Profile 已有实体 + Community Catalog 已审核参考实体。

Community Catalog 不会制造假的作品计数，因此新增目录项通常会显示 `0 部作品`。


## V1-27D：多语言与 Browse 关系展示

Community Catalog 的名称不再假设“三语都必须存在”。Maker / Label 等品牌实体优先保存来源原名和已审核品牌写法；描述性 Label / Series 才逐步加入社区翻译。`nameKinds` 用来标识原名、品牌写法、社区翻译或转写。

Browse 仍然是目录视图：有作品 / 无作品 / 全部 + 搜索。Maker → Label → Series 的已确认 parent 会作为卡片辅助信息显示，但 Browse 不增加级联筛选；跨 Maker / Label / Series / Genre 等组合查找作品由 Works 多维筛选负责。
