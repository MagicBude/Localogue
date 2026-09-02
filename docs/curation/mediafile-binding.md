# MediaFile 人工绑定治理

## 为什么需要人工绑定

扫描器只有在文件名包含明确、规范化后的作品番号时才自动建立 `MediaFile.workId`。复杂命名、合集、误命名文件都允许保持 `workId = null`。

V1-11 增加：

```text
/media/[mediaFileId]
```

可以查看候选、按番号/标题搜索，然后明确执行绑定、改绑或解绑。

## 候选不是自动决策

候选的 `score/reasons` 只解释“为什么建议看这个 Work”，不能自动写入：

```text
Candidate → User Confirm → MediaFile.workId
```

这和 Evidence Entity Resolution 的原则一致：**建议可以宽一点，自动写入必须保守。**

## 审计 Receipt

每次实际变化生成：

```text
media-binding-receipts/<receipt-id>.json
```

保存 before/after Work ID、动作与时间。Receipt 写入失败时，Service 尝试把 MediaFile 恢复到修改前状态。
