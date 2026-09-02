# 示例数据

这里的资料全部是结构示例，不代表真实作品或真实人物。

用途：

- 让开发者直观看懂 Domain Model；
- V1 初期作为页面假数据；
- 用于 JSON 校验和 Repository 测试；
- 避免测试依赖真实私人资料。


## V1-05 审核示例

`imports/sample-existing-work.json` 使用已经存在于 Demo Library 的 `DEMO-001`，并故意把时长从正式资料的 128 分钟写成 130 分钟。

它用于学习：

```text
Evidence
  ↓
按番号匹配已有 Work
  ↓
实体匹配
  ↓
字段差异
```

导入并保存后，到 `/review` 查看审核结果。


## V1-09

- `shared-packs/starter-community-pack/`：完全虚构的 Shared Pack 示例。
- `settings/settings.example.json`：实例设置文件示例。
