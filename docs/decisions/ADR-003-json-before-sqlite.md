# ADR-003：V1 JSON，V2 SQLite

**状态：已接受。**

V1 使用 JSON 以降低理解和调试成本，先验证产品与数据模型。V2 在 Repository 抽象下迁移 SQLite，不推倒业务层。CSV / XLSX 作为交换格式长期保留。
