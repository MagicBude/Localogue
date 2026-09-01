# 项目状态

## 当前版本

- 阶段：V1
- 子阶段：V1-01 Foundation / 浏览基础
- 名称：Localogue
- 状态：开发中
- 日期：2026-09-01

## V0 已完成

- 产品定位、范围、路线图；
- 核心架构原则；
- Domain Model 设计；
- JSON-first → SQLite 演进路线；
- 受控词表；
- 多语言、筛选、排序、时间线设计；
- Import / Evidence / Review 设计；
- UI 信息架构；
- ADR 和参考项目研究。

## V1-01 已实现

- Next.js 16.3.3 + React 19 + TypeScript；
- 单应用结构，不提前引入 monorepo；
- Domain / Application / Infrastructure / UI 分层；
- `LibraryRepository`；
- `JsonLibraryRepository`；
- JSON 原子写入基础；
- Work / Person / Organization / Series / Asset / MediaFile / Genre / Tag 模型；
- 8 条虚构作品、6 条虚构人物及关联样例；
- 首页；
- 作品库；
- 作品详情；
- 演员库；
- 高信息密度演员详情页；
- 人物旧艺名 / 别名 / 名称映射展示；
- 人物状态与职业事件时间线；
- UI Language / Metadata Language 分离；
- 日 / 中 / 英元数据回退；
- Light / Dark / System 主题；
- WorkQuery 基础；
- 番号 / 标题搜索；
- 人物、导演、Maker、Label、Series、Genre、Work Type、Tag、年份、日期、时长条件；
- 多种排序；
- 基础 Facet Count；
- 人物页复用 WorkQuery 二次筛选。

## V1-01 有意暂缓

以下内容仍属于 V1，但没有塞入第一批代码：

- CSV 导入 / 导出；
- XLSX 导入 / 导出；
- NFO 解析；
- 文件夹扫描；
- Evidence 实际落盘；
- Review 页面；
- 手工新增 / 编辑表单；
- 完整的 Facet 自排除计数算法；
- 月份 / 任意日期范围 UI；
- Tag 筛选 UI（Query Engine 已具备字段）；
- 导演独立浏览页；
- Maker / Label / Series 独立详情页；
- 列表视图 / 表格视图；
- 资料完整度算法。

## 下一步建议：V1-02

优先完成“浏览系统增强”，再进入导入：

1. 完善 Faceted Search，使每个 Facet 计算时排除自身条件；
2. 增加导演、Maker、Label、Series、Genre 的可点击详情/筛选入口；
3. 增加月份、日期范围、Tag、是否有封面 / 本地文件筛选 UI；
4. 增加海报墙 / 列表 / 表格视图切换；
5. 增加作品和人物的真正分页；
6. 再开始 Import / Evidence / Review。
