# 测试原则

V1 优先覆盖：

- 番号规范化；
- 日期与时长解析；
- 多语言 fallback；
- 人物名称匹配；
- 受控词表映射；
- WorkQuery 组合筛选；
- 排序稳定性；
- JSON Schema 兼容；
- Import Diff；
- Review 后写入结果。

V2 再增加 Repository Contract Test，确保 JSON Repository 与 SQLite Repository 的行为一致。
