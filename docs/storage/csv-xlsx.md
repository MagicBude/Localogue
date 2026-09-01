# CSV / XLSX 存储角色

CSV 和 XLSX 是**交换格式**，不是 Canonical Library。

## CSV

适合单表、程序间交换。

## XLSX

适合人类批量整理，可使用多个工作表表达关系。

## 推荐流程

```text
Canonical JSON
  ↓ 导出
CSV / XLSX
  ↓ 人工编辑
重新导入
  ↓
Evidence + Diff
  ↓
Review
  ↓
Canonical JSON
```

这样 Excel 修改不会绕开审核逻辑。
