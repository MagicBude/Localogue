# V1-27A：Maker / Label / Series Registry Foundation

## 当前模型审计

Localogue 的 `Organization` 已经区分 `maker / label / agency / other`，并允许 `parentOrganizationId`，因此 Maker → Label 不需要另起一套实体模型。V1-27A 给 `Series` 增加可选 `parentOrganizationId`，补齐 `Maker → Label → Series` 的表达能力。

父子关系必须来源明确：系列优先挂到 Label；只有 Maker 证据时可暂挂 Maker；没有证据保持空值。


## 当前示例库审计基线

当前 `data/demo-library` 的结构基线为：

- Maker：2
- Label：2
- Maker → Label：2 组关系均已通过 `parentOrganizationId` 表达
- Series：3
- 已关联父 Organization 的 Series：0
- 尚未关联的 Series：3
- Works：8

这 3 个未关联 Series 不代表数据错误；它们是旧模型没有归属字段留下的历史空值，因此 V1-27A 只 warning，不自动猜测归属。

## Provider 能力

| Provider | Maker | Label | Series | 本轮定位 |
| --- | --- | --- | --- | --- |
| FANZA/DMM v3 | MakerSearch 可枚举 | 暂未确认独立枚举 | SeriesSearch 可枚举 | 下一轮主数据源 |
| JAVDB | typed maker search + detail ID | 未单独确认 | typed series search + detail ID | ID 交叉验证 / Web index |
| JAVBus | detail producer ID | detail publisher ID | detail series ID | 稳定 ID/name 证据 |
| JAVLibrary | detail name | detail name | 本轮未验证 | 名称证据 / 别名辅助 |

## V1-27A 首批真实证据

首批 Registry 只写入可以解释来源的记录。JAVBus 的示例详情明确给出 `producer 7q = エスワン ナンバーワンスタイル`、`publisher 9x = S1 NO.1 STYLE`；JAVLibrary 只作为 Maker/Label 名称证据，不伪造站内 ID。

## 为什么现在不直接做自动合并

`S1 NO.1 STYLE`、`エスワン ナンバーワンスタイル` 这类名称很可能属于同一商业实体的不同角色/显示名，但 Maker 与 Label 是不同语义层。V1-27A 只保存证据，不因字符串相近自动合并。后续需要 Canonical Organization alias + Provider ID 映射规则后再审核绑定。

## 命令

```bash
pnpm validate:registry
pnpm registry:audit
```

`registry:audit` 默认检查 `data/demo-library`；也可以：

```bash
node scripts/audit-organization-series.mjs --library /path/to/library
```

未填写 Series 父组织当前只作为 warning，不阻塞旧资料库；引用不存在的 Organization 才是 error。
