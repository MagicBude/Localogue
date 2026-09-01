# V1-04 已实现的导入格式

## JSON

支持：

- 单个对象；
- 对象数组；
- Localogue Work JSON；
- 常见扁平字段 JSON。

常见字段别名会进入 Normalizer，例如 `productid → code`、`runtime → durationMinutes`。

## NFO

V1-04 使用 XML Parser 读取常见 `<movie>` 结构，首批映射：

- `title`
- `originaltitle`
- `num / number / id`
- `premiered`
- `runtime`
- `actor/name`
- `director`
- `studio`
- `set`
- `genre`
- `tag`
- `plot / outline`

不同软件的特殊 NFO 差异会在后续版本逐渐扩展 Adapter。

## CSV

- 第一行为字段名；
- 多值字段建议使用 `|` 分隔；
- 支持标准双引号字段和逗号转义；
- V1-04 默认按 UTF-8 读取。

示例：`examples/imports/sample-works.csv`。

## XLSX

- 优先寻找名为 `作品` 的工作表；
- 如果不存在，则读取第一个工作表并给出警告；
- 第一行为字段名；
- 多值字段同样建议用 `|` 分隔。

示例：`examples/imports/sample-works.xlsx`。

## 当前限制

- 单文件 10 MB；
- 暂不支持 `.xls`；
- 暂不自动探测 Shift-JIS 等字符编码；
- 暂不做 Canonical Person / Maker / Genre 的实体匹配；
- 暂不提交到正式 `works/`。
