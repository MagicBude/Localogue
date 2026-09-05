# Provider Genre Coverage

Localogue 不把某个站点的 `genre/tag/category` 桶直接等同于 Canonical Genre。

Provider Coverage 的目标是：**每个已收集来源词都必须能被解释**，并明确进入以下五种结果之一：

1. Canonical Genre；
2. Work Type；
3. Source-only Classification；
4. Review Required；
5. Unmapped。

只有 1–3 可以自动路由。复合词和多义词保留 Raw Term，并进入 Review；Unmapped 则表示当前词表仍有真实缺口。

## V1-25B Round 1

本轮先建立四个 Provider 输入快照：

| Provider | 输入词条 | 自动 Genre | Work Type | Source-only | Review | Unmapped | 自动覆盖率 | 已识别覆盖率 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| FANZA | 260 | 194 | 19 | 21 | 26 | 0 | 90.0% | 100.0% |
| JAVLibrary | 286 | 227 | 27 | 23 | 9 | 0 | 96.9% | 100.0% |
| JAVBus | 35 | 34 | 0 | 0 | 1 | 0 | 97.1% | 100.0% |
| JAVDB | 32 | 32 | 0 | 0 | 0 | 0 | 100.0% | 100.0% |

> `100% 已识别` 只针对当前已经收集进仓库的 Provider Snapshot，不代表 Provider 全站分类已经 100% 枚举。

### FANZA

来源快照：MetaTube Discussion #621，2026-03-20 发布的 FANZA genre 替换清单。

本轮发现并补入了此前 Canonical 中确实缺失的稳定概念，例如：

- アスリート / Athlete；
- オタク / Otaku；
- オナサポ / Masturbation Support；
- お婆ちゃん / Grandmother；
- 叔母さん / Aunt；
- 極道 / Yakuza；
- スワッピング / Partner Swapping；
- チアガール / Cheerleader；
- ノーパン / No Panties；
- ノーブラ / Braless；
- ハーレム / Harem；
- 変身ヒロイン / Transforming Heroine；
- ヨガ / Yoga；
- 早漏 / Premature Ejaculation；
- 軟体 / Flexible Body；
- Vシネマ / V-Cinema；
- BL / Boys Love；
- お漏らし / Wetting；
- ゲロ / Vomit；
- 鼻フック / Nose Hook；
- ゲーム実写版 / Game Live-action Adaptation。

同时没有把以下内容错误提升为 Genre：

- `独占配信` / `FANZA配信限定`：Distribution Source-only；
- `スマホ推奨縦動画`：Technical Format Source-only；
- `セット商品`：Product Format Source-only；
- 各类 `xx%OFF`、`ポイント還元`、`期間限定セール`：Provider Marketing Source-only；
- `VR専用` / `ハイクオリティVR`：路由到 Work Type `vr`；
- `16時間以上作品`：作为 `over_four_hours` 的来源别名，Raw Term 仍保留 16 小时信息。

FANZA 官方 DMM Affiliate API 另有 `GenreSearch`，支持按 `floor_id` 枚举 Genre。当前没有可复核的实时 floor 导出，因此本轮只保存真实名称，不伪造 Genre ID。

### JAVLibrary

MetaTube Discussion #308 中，2024 文件作者明确说明 `356 Genre substitution` 使用 `javlibrary.com` 作为来源；2025-03-29 的 JP→ZH 文件再次明确标注 `source: JAVLibrary`。

本轮使用较新的 2025 快照，剔除分类分段标题后得到 286 个真实分类词：

- 277 个可以自动进入 Genre / Work Type / Source-only；
- 9 个复合词进入 Review；
- 0 Unmapped。

因此 JAVLibrary 对当前 Localogue Vocabulary 是一个很好的回归基准。

### JAVBus

JAVBus 的分类 ID 可作为 `filterType=genre` 的 `filterValue` 使用。Round 1 曾从旧 `genre-source-aliases` 的 `sources` 字段反推 Provider 归属，得到 35 条；V1-25C 审计确认这种推导不成立，因此该数字只保留作历史记录，不再作为可信 ID slice。

Round 2 改为只接受 Provider 页面/API/公开文档直接证据。当前保存 9 个可复核 ID/name 对；例如公开 API 示例给出 `e=巨乳`，保存的 JAVBus 作品页直接给出 `3f=深喉`、`7i=孕ませ`、`4=中出`、`2t=花癡`、`1y=其他戀物癖`、`4o=高畫質`、`f=單體作品`，公开工具文档另核实 `6j=温泉`。

### JAVDB

JAVDB 的公开签名 API `/api/v2/tags?type=0..4` 返回分组标签字典，包含：

- `category`；
- `category_id`；
- nested `tags[].id`；
- nested `tags[].name`。

类型包括 Censored / Uncensored / Western / FC2 / Carton/Anime。当前 Catalog 保存的 32 条明确标为 **legacy web-filter namespace**；它们不再被描述成现代 `/api/v2/tags` 的完整/实时导出。等取得实时签名 API 导出后，应以新的 namespace 保存 `type + category_id + tag.id + name`。

## V1-25C Round 2：Provider ID 身份隔离

Round 2 首先修复 ID 证据边界，而不是继续堆数字。`sourceId` 现在必须通过 `idSource` 指明唯一 Provider；`sources` 只作为名称 Evidence。旧 ID 没有足够 Provider 证据时标记为 `legacy-unscoped`，不会再自动复制到 JAVBus / JAVLibrary Catalog。

当前覆盖快照：

| Provider | 输入词条 | 自动 Genre | Work Type | Source-only | Review | Unmapped | 自动覆盖率 | 已识别覆盖率 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| FANZA | 260 | 194 | 19 | 21 | 26 | 0 | 90.0% | 100.0% |
| JAVLibrary | 286 | 227 | 27 | 23 | 9 | 0 | 96.9% | 100.0% |
| JAVBus | 9 | 6 | 1 | 1 | 1 | 0 | 88.9% | 100.0% |
| JAVDB | 32 | 32 | 0 | 0 | 0 | 0 | 100.0% | 100.0% |

JAVBus 从 35 降到 9 是**证据质量收紧**，不是覆盖回退：旧 35 中存在 JAVDB ID 被错误归到 JAVBus 的情况。新 9 条全部有 Provider 级证据；其中 `高畫質` 路由 Source-only、`單體作品` 路由 Work Type、`花癡` 保留 Review，不为了提高 Genre 数字改变语义。

JAVLibrary 286 个真实 label 保持不变，但旧跨站 alias 推导出的 Provider ID 全部撤销；当前只保留独立文档核实的 `a4hq=韓国`。

JAVDB 的公开签名 API `/api/v2/tags?type=0..4` 已确认返回 `category/category_id + tags[].id/name` 的分组字典；本环境无法完成带签名实时导出，因此本轮不伪造“全量 numeric ID”数据。

## 命令

单个任意来源表：

```bash
pnpm vocabulary:coverage -- path/to/provider-terms.txt
```

全部已收集 Provider：

```bash
pnpm vocabulary:provider-coverage
```

回归检查：

```bash
pnpm validate:provider-coverage
```

`validate:provider-coverage` 要求当前 Provider Catalog 中不存在 Unmapped / Runtime Ambiguous；Review Required 是允许的，因为它代表明确的人工治理状态，而不是静默猜测。

## 下一轮

优先级建议：

1. 在可访问 JAVDB 签名 API 的环境获取 `/api/v2/tags?type=0..4` 实时导出，并以独立 namespace 保存 `type + category_id + tag.id + name`；
2. 为 JAVBus 找到可复核的完整 Genre ID 列表，而不是只扩充 label；
3. 使用 FANZA `GenreSearch` 对目标 Adult floor 做一次 ID 级导出；
4. 对比 JAVLibrary 2024 / 2025 Snapshot，标记新增、移除和改名；
5. 只在语义稳定时把新的来源词提升为 Canonical；Provider 活动、画质、载体、促销继续留在 Source-only。
