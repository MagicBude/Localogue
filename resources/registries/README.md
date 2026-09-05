# Organization / Series Registry Resources

V1-27A 建立 Maker / Label / Series 的来源 Registry 基础。

- `provider-entity-sources.*`：记录每个 Provider 对 Maker / Label / Series 的可枚举能力、ID 稳定性与限制。
- `organization-source-evidence.*`：首批真实来源名称/ID 证据。它不是 Canonical Organization 列表，也不能因为名字相似就自动合并。

## 关键边界

1. Provider 的 `sourceId` 必须和 Provider 绑定，不能跨站复用。
2. `name-only` 只证明某来源出现过该名称，不证明它与某 Canonical Organization 相同。
3. Maker → Label 使用 `Organization.parentOrganizationId`。
4. V1-27A 起 Series 可选使用 `parentOrganizationId` 指向最具体、已确认的 Label；若只能确认 Maker，则可暂时指向 Maker。
5. 没有证据的父子关系保持空值，不做名称猜测。
