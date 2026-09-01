# V1-04：导入流水线实现导读

## 这一版解决什么问题

V1-03 之前，Localogue 已经能浏览 Demo Library，但还不能把用户自己的元数据真正送进系统。

V1-04 第一次实现可运行的导入入口：

```text
JSON / NFO / CSV / XLSX
          ↓
       Importer
          ↓
      Normalize
          ↓
       Validate
          ↓
       Preview
          ↓
    保存为 Evidence
```

注意最后一步仍然不是 `Work`。

这是 Localogue 最重要的架构边界之一：**Parser 负责读懂输入，Review 才有资格决定正式资料库如何变化。**

## 代码阅读顺序

1. `src/domain/entities/evidence.ts`
2. `src/infrastructure/importers/importer-types.ts`
3. `src/infrastructure/importers/importer-registry.ts`
4. `src/infrastructure/importers/json-importer.ts`
5. `src/infrastructure/importers/nfo-importer.ts`
6. `src/infrastructure/importers/csv-importer.ts`
7. `src/infrastructure/importers/xlsx-importer.ts`
8. `src/application/importers/import-normalizer.ts`
9. `src/application/importers/import-validation.ts`
10. `src/app/api/import/preview/route.ts`
11. `src/components/import-workbench.tsx`
12. `src/infrastructure/evidence/evidence-store.ts`

## Parser、Normalizer、Validator 为什么分开

假设 NFO 使用：

```xml
<runtime>125</runtime>
```

CSV 使用：

```text
durationMinutes
```

某个 JSON 又使用：

```json
{"duration": "125 min"}
```

如果每个 Importer 都自己决定最终字段，就会产生四套规则。

因此 Localogue 拆成：

- **Parser**：负责“这个文件格式是什么结构”；
- **Normalizer**：负责“不同叫法如何转成统一字段”；
- **Validator**：负责“统一字段有没有明显问题”。

这也是以后增加 Connector 时可复用的结构。

## 为什么现在不自动匹配 Person

导入数据里的演员可能只是字符串：

```text
星野みづき
```

而 Canonical Library 中 Person 使用稳定 ID：

```text
person_hoshino_mizuki
```

两者是否为同一人不能由 Parser 猜测。未来应进入 Entity Resolution：

```text
输入名称
  ↓
正式名 / 中文名 / 罗马字 / 旧艺名 / 别名匹配
  ↓
候选 Person
  ↓
Review 确认
```

因此 V1-04 的 `performers` 暂时保留来源字符串。

## 为什么 Evidence 默认写到 data/library

浏览器未配置 `LOCALOGUE_LIBRARY_PATH` 时，为了方便演示，页面读取：

```text
data/demo-library
```

但真实导入绝不能把 Demo 数据改掉，所以 Evidence 默认写到：

```text
data/library/evidence
```

`data/library` 已被 Git 忽略。

这是“公开 Demo”和“私人资料”物理隔离原则的延续。
