import type { SupportedLanguage } from "@/domain/value-objects/localized-text";

const dictionaries = {
  "zh-CN": {
    pending: "待审核",
    committed: "已归档",
    ignored: "已忽略",
    ignore: "忽略这条 Evidence",
    restorePending: "恢复为待审核",
    ignoredHint: "这条 Evidence 已被忽略，不会参与正式归档；原始 Evidence 文件仍完整保留。",
    pendingHint: "Evidence 正在等待审核。",
    committedHint: "Evidence 已完成 Canonical Commit。",
    all: "全部",
  },
  ja: {
    pending: "レビュー待ち",
    committed: "コミット済み",
    ignored: "無視",
    ignore: "この Evidence を無視",
    restorePending: "レビュー待ちへ戻す",
    ignoredHint: "この Evidence は無視されています。正式コミットには使われませんが、原始 Evidence は保持されます。",
    pendingHint: "Evidence はレビュー待ちです。",
    committedHint: "Evidence は Canonical Commit 済みです。",
    all: "すべて",
  },
  en: {
    pending: "Pending",
    committed: "Committed",
    ignored: "Ignored",
    ignore: "Ignore this Evidence",
    restorePending: "Return to pending",
    ignoredHint: "This Evidence is ignored and will not be committed, while the original Evidence remains intact.",
    pendingHint: "This Evidence is waiting for review.",
    committedHint: "This Evidence has been committed to the Canonical Library.",
    all: "All",
  },
} as const;

export function getLifecycleDictionary(language: SupportedLanguage) {
  return dictionaries[language];
}
