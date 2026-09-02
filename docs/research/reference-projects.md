# 参考项目分析

> 本文记录 Localogue 在 V0 阶段重点参考的项目及吸收方向。项目状态会变化，具体实现应以对应仓库当时版本为准。

## 1. MDC-NG

仓库：<https://github.com/mdc-ng/mdc-ng>

主要参考：

- 现代 Web 管理体验；
- 任务与处理记录；
- 文件整理模式；
- 人工修正工作流。

Localogue 不照搬：以刮削和自动文件整理作为核心。

## 2. MDCx

仓库：<https://github.com/sqzw-x/mdcx>

主要参考：

- 长期积累的 NFO / 文件命名实践；
- 多来源字段和媒体生态兼容经验；
- 真实用户对元数据字段的需求。

Localogue 不照搬：把大量在线 crawler 维护作为核心竞争力。

## 3. mdcx_sqlite

仓库：<https://github.com/bobo946/mdcx_sqlite>

主要参考：

- 已刮削 NFO → SQLite 的现实需求；
- 把媒体旁路资料转成可检索数据库的思路。

Localogue 的进一步设计：不按 NFO tag 机械建表，而建立真正的 Work / Person / Series / Genre 等关系实体。

## 4. CM Collectors

仓库：<https://github.com/congzhen/cm_collectors_3>

主要参考：

- 收藏浏览；
- 视频、图片、文件统一管理的产品思路；
- 本地媒体管理体验。

Localogue 不照搬：V1 不把播放器、转码、流媒体能力作为核心。

## 5. Amane

仓库：<https://github.com/sqzw-x/amane>

主要参考：

- 本地优先；
- 数据库作为资料核心；
- Metadata 与 MediaFile 分离；
- 多来源聚合与结构化处理；
- Web 化私人影库体验。

Localogue 与其差异：

- Localogue 更强调 Curation 和可追溯资料治理；
- V1 不追求自动抓取、调度、AI、目录监控等大而全自动化；
- 任何外部来源最终只是 Evidence。

## 6. mdcx-diy

仓库：<https://github.com/cdlongbow/mdcx-diy>

主要参考：

- 大量实际元数据源、NFO 字段、命名和媒体整理经验；
- 用户真实使用场景中的兼容需求。

Localogue 不照搬：维护大量站点爬虫、反爬适配和在线依赖。

## 结论

Localogue 不尝试成为“第 N 个 MDCx”。

它的定位是：

```text
采集工具 / NFO / JSON / CSV / XLSX / 手工资料
                       ↓
                    Evidence
                       ↓
              Normalize + Review
                       ↓
              Canonical Library
                       ↓
       浏览 / 筛选 / 时间线 / 导出 / 未来 AI
```

## Achaiccccc/local-javlibrary

Electron + Vue 3 的本地 NFO 影视库。Localogue 主要参考其后续版本在以下方面的工程经验：

- 增量扫描与数据同步重构；
- 单例扫描任务，避免重复触发；
- NFO / Poster / Fanart 伴随文件发现；
- 大数据量下的后端分页、懒加载与虚拟列表；
- 演员外挂头像和本地选择；
- Desktop Main / IPC / UI 分层。

Localogue 不采用“NFO 直接成为数据库真相”的模型，仍保持 Evidence → Review → Canonical；也不复制该 GPL-3.0 项目的具体实现代码。

详见：[local-javlibrary 对 Localogue 的参考价值](local-javlibrary-reference.md)。
