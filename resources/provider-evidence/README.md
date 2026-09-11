# Provider Evidence

这里保存外部 Provider 的可复核来源快照，供离线映射、差异比较和人工审核使用。

它与 `resources/vocabularies/provider-genre-catalogs/` 的职责不同：

- `provider-evidence/` 可以包含尚未映射、重复或相互冲突的原始来源事实；
- `provider-genre-catalogs/` 只进入正式 Coverage，要求每条都已识别或明确 Review；
- 两者都不是 Canonical Genre，不能直接覆盖用户或社区资料。

JavBus 的更新和验证方法见 `docs/vocabulary/javbus-genre-audit.md`。
