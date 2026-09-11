# Localogue 换机交接

更新日期：2026-09-11。用户已要求本轮收口提交上传，之后在另一台电脑继续。**等待用户验收；不等于全流程完成。**

当前最新导航节点：详情页只保留右下角悬浮返回；作品与人物分页共用 `desktop-pagination.tsx`，只在吸顶筛选区显示。顶部应用框架新增作品搜索和紧凑语言菜单，删除重复设置与手动刷新。继续开发时不要重做分页或浏览快照，先验收长页面中段返回、吸顶翻页、搜索、翻页后定位和多级关系返回。

当前作品交互节点：详情页编辑入口已提升到首屏标题操作区，编辑内容放入独立宽弹窗；作品库高级筛选改为覆盖式浮层，默认工具栏只占一行。该设计参考了本地 `JavBoss/web/src/components/JavDetailModal.jsx` 的首屏编辑操作和临时筛选范式，但继续复用 Localogue 的 WorkQuery、Private Override 与审计边界。后续先做实机手感验收，不要重新放回底部长表单或常驻大筛选面板。

第一版 820px 横向高级筛选浮层已被用户实机否决，禁止恢复。随后实现的窗口右侧 410px 单列筛选板只是过渡节点；新建作品已从大卡片收敛为按钮和弹窗。继续时不得再堆叠大面积表单卡片。

后续研究确认汇总侧板仍然过重，正式实现已改为目录、人物、分类、更多四个 320px 锚点菜单，一次只打开一个；已选条件使用单行横向 Chips。可拖动侧板提交 `e40f075` 仅保留在 Git 历史作为用户要求的独立节点，当前主流程不再使用，禁止再次恢复成汇总大框。

页面顶部已开始统一压缩：共享 PageTitle / GovernanceTitle 去掉英文开发阶段口号；作品库标题与新建按钮同排；首页大 Hero 改成横向短条。继续维护时不要重新加入大字号宣传标题或 V1 技术实现说明，页面首屏优先留给真实内容和当前操作。

统一确认节点：全部 `window.confirm` 已由应用级 `UiConfirmProvider` 替换。后续不要在业务页面重新引入浏览器原生确认框；实际删除、Review Commit 和 History Restore 需使用隔离测试库验收确认 / 取消分支。

## 代码与本机数据

- 仓库：`https://github.com/MagicBude/Localogue.git`，当前工作分支 `main`。
- 原电脑路径：`D:\Github\jav\Localogue`，参考仓库：`D:\Github\jav\JavBoss`。新电脑请先核实实际路径，参考仓库不存在时不得假装已经读过。
- 新电脑先 `git status`；干净工作区使用 `git pull --ff-only`，本地有修改或分叉则先检查，禁止强制重置、覆盖用户文件或强推。
- Git 不携带私人资料库、影片、AppData 设置或本机依赖。不要提交这些数据；新电脑通过设置选择自己的内容目录和私人资料库。原电脑的盘符路径不能直接当作新电脑可用配置。
- Dev 与 Release 标识和 AppData 隔离；但 Dev 也可能已配置真实私人资料。本轮看到的是用户数据，不是可随意重置的 fixture。
- 依赖按项目锁文件安装：`pnpm install --frozen-lockfile`。检查 Node/pnpm、Rust、Windows 构建工具、WebView2 后运行 `pnpm desktop:doctor`。

## 本轮已提交节点

| 提交 | 内容 |
| --- | --- |
| `3a6a3c7` | 详情草稿隔离、标签同步修改锁、批量私人归属读取 |
| `5832a80` | 离线三语帮助、手动更新说明、长弹窗滚动 |
| `4f3556c` | 首页分类名称/导航、收藏评分错误提示 |
| `4be83c9` | Toast 真正淡出与减少动态效果适配 |
| `e4aed85` | 异常详情返回入口、人物状态展示映射 |
| `110c313` | 人物编辑候选搜索别名与全半角规范化 |
| `61bd3be` | 作品编辑取消草稿 |

后续收口提交包含瀑布流重复触发锁、完整台账与本交接文档，准确提交号以 `git log` 为准。上传期间曾出现 GitHub 连接重置；换机以成功拉取后的提交记录为准，不能把本地提交当作已上传证明。

## 继续工作的提示词

```text
请继续开发 Localogue，先核实仓库实际位置（原电脑为 D:\Github\jav\Localogue）。

开始顺序：
1. 阅读根目录 AGENTS.md 和 docs/README.md。
2. 阅读 PROJECT_STATUS.md、MANIFEST.md、CHANGELOG.md。
3. 阅读 docs/ui/information-architecture.md、docs/development/desktop-local-logging.md。
4. 阅读 docs/development/localogue-handoff.md 和 desktop-ux-audit.md，后者是本轮待办台账。
5. 查看 git status、最近 10 条 git log、当前 diff 和远端分支；保留本地修改。
6. 实际阅读当前实现再动手，不重新实现已完成的功能。

产品约束：继续维护 Localogue，单一 Desktop App；复用现有 Domain / Repository / Query，JSON 不引入 SQLite；Canonical / Evidence / Private Presentation Preference 边界不变。默认非破坏性，不拿用户真实资料测试删除、恢复或覆盖。Shared Pack 只读。日志只能读取 App Local Data 中固定 localogue.log。代码与文档使用清晰中文注释，界面支持中日英，元数据语言与 UI 语言独立。

按台账优先继续：
A. 返回原作品列表的筛选、页码/瀑布流批次和滚动位置已经实现并通过自动检查；仍需用户实机验收普通分页、瀑布流和多级详情返回，现有详情访问链不要重做。
B. 人物编辑取消、保存中输入/重复操作防护、收藏评分与封面偏好并发安全已经完成代码与自动检查；实际写入仍需隔离测试库验收。
C. 下一节点把剩余原生 confirm 渐进替换为统一 Radix 对话框，保留 Native 引用检查。
D. 标签空分类持久化、分类改名/排序展示、自定义标签编辑。
E. JavBus 两个 genre 索引页完整来源快照、去重和日中英逐项名称。现有 888 只是两页条目合计，绝非已完成三语库。来源原文/URL/时间要保留，缺译明确标记；不能机器猜测直接覆盖 Canonical，也不让启动依赖联网。参考 JavBoss 必须实际读代码。
F. 隔离测试库审核导入预览/取消/失败、备份恢复、设置、关于、帮助及更新流程。
G. 复现开发 HMR 的语言 Context 白屏；重新加载曾可恢复，不代表已修复。在线检查/安装更新尚未实现，不显示假的“已是最新”。

界面保持清爽易懂：Fluent 图标、默认 68px 窄侧栏、顶部子分类、目录管理只在设置。基础组件逐步统一，不全量重写。不确定且改变产品方向的事项先提出讨论。

每个可运行节点同步修改记录和状态、完成针对性验证，再独立提交并上传；网络失败必须明确记录，不强推。
收尾运行 pnpm typecheck、pnpm desktop:typecheck、pnpm lint、pnpm validate:desktop、pnpm validate:platform、pnpm desktop:rust:check、pnpm desktop:build:webview、git diff --check。
最后启动 Desktop 或提供实际验收路径。build:webview 不生成新 EXE；不要把旧安装包说成当前构建结果。始终明确“等待用户验收”，不得因自动检查通过就宣布全部流程完成。
```
