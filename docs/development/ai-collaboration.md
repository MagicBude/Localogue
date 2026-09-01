# AI 协作

Localogue 是 AI Native 开发项目，但 AI 必须服从项目文档，而不是每次根据当前聊天重新发明架构。

## AI 开始工作前

至少读取：

1. `AGENTS.md`
2. `PROJECT_STATUS.md`
3. `docs/README.md`
4. 与当前任务相关的 `docs/` 文档
5. `docs/decisions/`

## AI 提交新设计时

必须说明：

- 是否改变现有原则；
- 是否改变数据模型；
- 是否需要新词表；
- 是否影响 V1 → V2 迁移；
- 是否需要 ADR。

## 禁止

- 仅凭“实现简单”把关系退化成字符串；
- 未更新文档就大改字段语义；
- 为了一个页面把 Domain Model 和 UI 强耦合；
- 私自把在线抓取重新提升为核心依赖。
