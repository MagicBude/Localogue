# ADR-047：Desktop 作为正式产品入口，分阶段冻结 Web

**状态：提议中。**

## 背景

Localogue 同时维护 Next.js Web 与 Tauri Desktop。两者共享 Domain / Application 规则，但普通用户需要的是能访问本地目录、显示扫描进度并委托播放的单一桌面应用。继续把两个入口都作为正式产品，会造成重复 UI、重复验收和产品说明混乱。

Web 仍承载部分历史治理能力、开发调试路径和服务端 Adapter，立即删除会导致能力倒退。

## 提议

1. Desktop 成为唯一面向普通用户的正式产品入口；
2. Web 停止增加独立产品功能，只接受共享 Core 所需的修复；
3. 建立 Web → Desktop 能力清单，逐项迁移治理、导入、历史和恢复能力；
4. 能力迁移并完成 Desktop 实机验收后，再删除 Next.js UI 与 Route Handler；
5. `src/domain`、`src/application`、必要 CLI 与校验脚本不随 Web 退役；
6. Web 退役不得导致页面直接读取文件、Desktop 复制业务规则或 Native 权限扩大。

## 接受条件

- Desktop 覆盖普通使用和治理流程；
- Web 专属 Route Handler 均有替代或明确删除理由；
- 文档、开发命令与 CI 完成迁移；
- Windows 实机验收通过，且没有用户数据迁移风险。

## 当前影响

在本 ADR 被正式接受前，Web 保留且可以运行；文档不再把它作为新用户推荐入口，也不宣称它已经退役。
