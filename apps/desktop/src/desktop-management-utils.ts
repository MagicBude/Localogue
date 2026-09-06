import type { LocalizedText } from "@/domain/value-objects/localized-text";

/** Work 与 Person 表单共用的无状态规范化函数。 */
export function datePrecision(value: string): "year" | "month" | "day" {
  if (/^\d{4}$/.test(value)) return "year";
  if (/^\d{4}-\d{2}$/.test(value)) return "month";
  return "day";
}

export function compactLocalizedText(value: Record<"ja" | "zh-CN" | "en", string>): LocalizedText {
  return Object.fromEntries(Object.entries(value).map(([language, text]) => [language, text.trim()]).filter(([, text]) => text)) as LocalizedText;
}

/**
 * 返回人物在某种语言下用于界面展示的名称。
 *
 * Person.names 还可能保存旧艺名、别名等历史事实，因此这里仅挑选 primary、
 * localized 或 romanized 名称，绝不能把数组中碰巧排在前面的 alias 当成可编辑主名称。
 */
export function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
